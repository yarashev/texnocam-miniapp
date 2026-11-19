import { reviewMarkup } from './service-workflow.js';
import {notificationLease,utc} from './notification-delivery.js';
import {prepareWorkerDelivery,recordWorkerDelivery} from './worker-delivery.js';
const RETRY_MINUTES = [1, 3, 10, 30, 120, 360, 720, 1440];

export async function enqueueCustomerNotification(database, input) {
  if (!input?.userId || !input?.eventKey || !input?.message) return;
  await database.run(
    `INSERT INTO customer_notifications
      (user_id, order_id, event_key, title, message, delivery_status, next_attempt_at,delivery_json)
     VALUES (?, ?, ?, ?, ?, 'pending', ?,?)
     ON CONFLICT(event_key) DO NOTHING`,
    input.userId, input.orderId ?? null, input.eventKey,
    String(input.title || 'UzCam xabarnomasi').slice(0, 120),
    String(input.message).slice(0, 3500),
    new Date().toISOString().slice(0, 19).replace('T', ' '), input.delivery?JSON.stringify(input.delivery):null
  );
}

export async function dispatchCustomerNotifications(database, sendTelegram, options = {}) {
  if(sendTelegram.retryAt?.()>Date.now())return {processed:0,sent:0};
  const limit = Math.max(1, Math.min(25, Number(options.limit) || 10));
  const rows = await database.all(
    `SELECT n.id, n.user_id, n.message, n.event_key, n.order_id,n.delivery_json, u.telegram_id
       FROM customer_notifications n
       JOIN users u ON u.id = n.user_id AND u.is_active = 1
       LEFT JOIN telegram_notification_preferences p ON p.user_id = u.id
      WHERE n.delivery_status = 'pending' AND (p.enabled = 1 OR n.event_key LIKE 'support:reply:%' OR n.event_key LIKE 'order:admin:%')
        AND n.attempts < 8
        AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= ?)
      ORDER BY n.created_at, n.id LIMIT ?`,
    new Date().toISOString().slice(0, 19).replace('T', ' '), limit
  );
  let sent = 0;
  for (const row of rows) {
    if(options.shouldStop?.())break;
    const lease=notificationLease();
    const claimed = await database.run(
      "UPDATE customer_notifications SET delivery_status = 'sending', attempts = attempts + 1,lease_token=?,lease_until=? WHERE id = ? AND delivery_status = 'pending'",
      lease.token,lease.until,row.id
    );
    if (!claimed.changes) continue;
    try {
      let payload={chat_id:row.telegram_id,text:row.message},method='sendMessage',delivery=null;
      if(row.delivery_json){
        delivery=JSON.parse(row.delivery_json);const prepared=await prepareWorkerDelivery(database,row,delivery);
        if(!prepared){await database.run("UPDATE customer_notifications SET delivery_status='failed',last_error='Superseded by current order state',lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?",row.id,lease.token);continue;}
        ({payload,method}=prepared);
      }
      if(String(row.event_key||'').startsWith('service:review:')) {
        const job=await database.get("SELECT state,selected_rating FROM service_jobs WHERE order_id=?",row.order_id);
        if(job?.state==='awaiting_customer')payload.reply_markup=reviewMarkup(row.order_id,job.selected_rating);
      }
      let result;
      try{result=await sendTelegram(method,payload)}catch(error){if(method.startsWith('editMessage')&&error.telegramAlreadyApplied){result={};}else throw error;}
      const acknowledge=async()=>{
        const updated=await database.run("UPDATE customer_notifications SET delivery_status = 'sent', sent_at = CURRENT_TIMESTAMP, last_error = NULL,lease_token=NULL,lease_until=NULL WHERE id = ? AND lease_token=? AND delivery_status='sending'",row.id,lease.token);
        if(!updated.changes)return;
        if(delivery)await recordWorkerDelivery(database,row,delivery,result);
        if(String(row.event_key||'').startsWith('support:reply:'))await database.run("UPDATE support_inbox SET status='answered',replied_at=CURRENT_TIMESTAMP WHERE reply_event_key=? AND status='reply_queued'",row.event_key);
        sent++;
      };
      if(database.transaction)await database.transaction(acknowledge);else await acknowledge();
    } catch (error) {
      const current = await database.get("SELECT attempts FROM customer_notifications WHERE id = ?", row.id);
      const attempts = Number(current?.attempts || 1);
      const terminal = attempts >= 8||[400,401,403].includes(error.telegramCode);
      const delay = RETRY_MINUTES[Math.min(attempts - 1, RETRY_MINUTES.length - 1)];
      const safeError = String(error?.message || 'Telegram yuborish xatosi').slice(0, 300);
      await database.run(
        `UPDATE customer_notifications
            SET delivery_status = ?, next_attempt_at = ?, last_error = ?,lease_token=NULL,lease_until=NULL
          WHERE id = ? AND lease_token=?`,
        terminal ? 'failed' : 'pending', utc(Date.now()+Math.max(delay*60,Number(error.retryAfter)||0)*1000), safeError, row.id,lease.token
      );
      if(error.telegramCode===429)break;
    }
  }
  return { processed: rows.length, sent };
}
