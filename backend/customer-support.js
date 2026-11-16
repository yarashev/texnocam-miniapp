import {randomUUID} from 'node:crypto';
import {enqueueCustomerNotification} from './customer-notifications.js';
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode})};
const allowed=actor=>{if(!actor||!['admin','super_admin'].includes(actor.role))fail('Admin ruxsati talab qilinadi',403)};
export async function initializeCustomerSupport(db){
 await db.run(`CREATE TABLE IF NOT EXISTS support_inbox (
 id TEXT PRIMARY KEY, customer_telegram_id TEXT NOT NULL, telegram_message_id INTEGER NOT NULL,
 admin_message_id INTEGER, message_text TEXT NOT NULL, media_type TEXT,
 status TEXT NOT NULL DEFAULT 'open', reply_text TEXT, reply_event_key TEXT, replied_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, replied_at TIMESTAMP,
 UNIQUE(customer_telegram_id,telegram_message_id))`);
}
export async function recordSupportMessage(db,message){
 const sender=message.from||{},tg=String(sender.id||'');if(!/^\d{5,20}$/.test(tg))return null;
 const name=[sender.first_name,sender.last_name].filter(Boolean).join(' ').slice(0,100);
 await db.run("INSERT INTO users(telegram_id,username,full_name,role) VALUES (?,?,?,'customer') ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,full_name=CASE WHEN excluded.full_name<>'' THEN excluded.full_name ELSE users.full_name END,updated_at=CURRENT_TIMESTAMP",tg,sender.username||null,name);
 const media=['photo','video','voice','document','audio','sticker','contact','location'].find(key=>message[key])||null;
 const text=String(message.text||message.caption||('['+(media||'Xabar')+']')).slice(0,4000);
 await db.run('INSERT INTO support_inbox(id,customer_telegram_id,telegram_message_id,message_text,media_type) VALUES (?,?,?,?,?) ON CONFLICT(customer_telegram_id,telegram_message_id) DO NOTHING',randomUUID(),tg,message.message_id,text,media);
 return db.get('SELECT id FROM support_inbox WHERE customer_telegram_id=? AND telegram_message_id=?',tg,message.message_id);
}
export async function listCustomers(db,actor,{q='',page=1,recent=false}={}){
 if(actor?.role!=='super_admin')fail('Faqat Super Admin mijozlarni ko‘radi',403);
 q=String(q||'').trim().slice(0,100).toLowerCase();page=Math.max(1,Math.min(100000,Number(page)||1));page=Math.floor(page);
 const params=['%'+q+'%','%'+q+'%','%'+q+'%','%'+q+'%','%'+q+'%'];
 const condition="u.role='customer' AND (LOWER(COALESCE(u.full_name,'')) LIKE ? OR u.telegram_id LIKE ? OR LOWER(COALESCE(u.username,'')) LIKE ? OR COALESCE(u.phone,'') LIKE ? OR EXISTS (SELECT 1 FROM orders phone_order WHERE phone_order.customer_id=u.id AND phone_order.delivery_phone LIKE ?))";
 const recentSql=recent?" AND EXISTS (SELECT 1 FROM orders r WHERE r.customer_id=u.id AND r.payment_status='confirmed' AND r.created_at>=?)":'';
 if(recent)params.push(new Date(Date.now()-30*86400000).toISOString().slice(0,19).replace('T',' '));
 const count=await db.get('SELECT COUNT(*) AS total FROM users u WHERE '+condition+recentSql,...params);
 const customers=await db.all(`SELECT u.id,u.telegram_id,u.username,u.full_name,u.phone,
 (SELECT COUNT(*) FROM orders o WHERE o.customer_id=u.id) AS order_count,
 (SELECT COALESCE(SUM(o.total_uzs),0) FROM orders o WHERE o.customer_id=u.id AND o.payment_status='confirmed') AS total_spent,
 (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id=u.id AND o.payment_status='confirmed') AS last_purchase,
 (SELECT o.delivery_phone FROM orders o WHERE o.customer_id=u.id ORDER BY o.created_at DESC LIMIT 1) AS delivery_phone
 FROM users u WHERE ${condition+recentSql} ORDER BY u.created_at DESC,u.id DESC LIMIT 30 OFFSET ?`,...params,(page-1)*30);
 return {customers,total:Number(count.total),page,pageSize:30};
}
export async function customerOrders(db,actor,id){
 if(actor?.role!=='super_admin')fail('Faqat Super Admin mijoz tarixini ko‘radi',403);
 return db.all('SELECT order_number,status,payment_status,total_uzs,created_at FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 50',id);
}
export async function listSupport(db,actor,{status='all',page=1}={}){
 allowed(actor);page=Math.max(1,Math.min(100000,Math.floor(Number(page)||1)));
 const condition=['open','reply_queued','answered','closed'].includes(status)?' WHERE s.status=?':'';
 const params=condition?[status]:[];
 const rows=await db.all(`SELECT s.*,u.full_name,u.username,n.delivery_status,n.last_error
 FROM support_inbox s LEFT JOIN users u ON u.telegram_id=s.customer_telegram_id
 LEFT JOIN customer_notifications n ON n.event_key=s.reply_event_key
 ${condition} ORDER BY s.created_at DESC,s.id DESC LIMIT 30 OFFSET ?`,...params,(page-1)*30);
 const total=await db.get('SELECT COUNT(*) AS total FROM support_inbox s'+condition,...params);
 return {messages:rows,total:Number(total.total),page,pageSize:30};
}
export async function replySupport(db,actor,id,text){
 allowed(actor);text=String(text||'').trim();if(!text||text.length>2000)fail('Javob 1–2000 belgi bo‘lsin');
 return db.transaction(async()=>{
 const row=await db.get('SELECT s.*,u.id AS customer_id FROM support_inbox s JOIN users u ON u.telegram_id=s.customer_telegram_id WHERE s.id=?',id);
 if(!row)fail('Murojaat topilmadi',404);
 if(row.status!=='open')fail('Bu savolga javob allaqachon qayd qilingan',409);
 const eventKey='support:reply:'+id+':'+randomUUID();
 const result=await db.run("UPDATE support_inbox SET status='reply_queued',reply_text=?,reply_event_key=?,replied_by=? WHERE id=? AND status='open'",text,eventKey,actor.id,id);
 if(!result.changes)fail('Murojaatni boshqa admin oldi',409);
 await enqueueCustomerNotification(db,{userId:row.customer_id,eventKey,title:'Admin javobi',message:'💬 UzCam adminidan javob:\n\n'+text});
 await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES (?,'reply','support_inbox',?)",actor.id,id);
 return {ok:true,status:'reply_queued'};
 });
}
