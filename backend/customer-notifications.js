import { reviewMarkup } from './service-workflow.js';
const RETRY_MINUTES = [1, 3, 10, 30, 120, 360, 720, 1440];

export async function enqueueCustomerNotification(database, input) {
  if (!input?.userId || !input?.eventKey || !input?.message) return;
  await database.run(
    `INSERT INTO customer_notifications
      (user_id, order_id, event_key, title, message, delivery_status, next_attempt_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)
     ON CONFLICT(event_key) DO NOTHING`,
    input.userId, input.orderId ?? null, input.eventKey,
    String(input.title || 'UzCam xabarnomasi').slice(0, 120),
    String(input.message).slice(0, 3500),
    new Date().toISOString().slice(0, 19).replace('T', ' ')
  );
}

export async function dispatchCustomerNotifications(database, sendTelegram, options = {}) {
  const limit = Math.max(1, Math.min(25, Number(options.limit) || 10));
  const rows = await database.all(
    `SELECT n.id, n.user_id, n.message, n.event_key, n.order_id, u.telegram_id
       FROM customer_notifications n
       JOIN users u ON u.id = n.user_id AND u.is_active = 1
       JOIN telegram_notification_preferences p ON p.user_id = u.id AND p.enabled = 1
      WHERE n.delivery_status = 'pending'
        AND n.attempts < 8
        AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= ?)
      ORDER BY n.created_at, n.id LIMIT ?`,
    new Date().toISOString().slice(0, 19).replace('T', ' '), limit
  );
  let sent = 0;
  for (const row of rows) {
    const claimed = await database.run(
      "UPDATE customer_notifications SET delivery_status = 'sending', attempts = attempts + 1 WHERE id = ? AND delivery_status = 'pending'",
      row.id
    );
    if (!claimed.changes) continue;
    try {
      const payload={chat_id:row.telegram_id,text:row.message};
      if(String(row.event_key||'').startsWith('service:review:')) {
        const job=await database.get("SELECT state,selected_rating FROM service_jobs WHERE order_id=?",row.order_id);
        if(job?.state==='awaiting_customer')payload.reply_markup=reviewMarkup(row.order_id,job.selected_rating);
      }
      await sendTelegram('sendMessage',payload);
      await database.run(
        "UPDATE customer_notifications SET delivery_status = 'sent', sent_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = ?",
        row.id
      );
      sent++;
    } catch (error) {
      const current = await database.get("SELECT attempts FROM customer_notifications WHERE id = ?", row.id);
      const attempts = Number(current?.attempts || 1);
      const terminal = attempts >= 8;
      const delay = RETRY_MINUTES[Math.min(attempts - 1, RETRY_MINUTES.length - 1)];
      const safeError = String(error?.message || 'Telegram yuborish xatosi').slice(0, 300);
      await database.run(
        `UPDATE customer_notifications
            SET delivery_status = ?, next_attempt_at = ?, last_error = ?
          WHERE id = ?`,
        terminal ? 'failed' : 'pending', new Date(Date.now() + delay * 60000).toISOString().slice(0, 19).replace('T', ' '), safeError, row.id
      );
    }
  }
  return { processed: rows.length, sent };
}
