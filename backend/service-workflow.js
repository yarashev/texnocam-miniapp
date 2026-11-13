import { enqueueCustomerNotification } from './customer-notifications.js';

export const labels = { accepted:'Qabul qilindi', travelling:'Yo‘lga chiqdi', working:'Bajarilmoqda', awaiting_customer:'Mijoz tasdig‘i kutilmoqda', disputed:'Dispetcher ko‘rib chiqmoqda', completed:'Yakunlandi' };
const fail = (message, statusCode=409) => { throw Object.assign(new Error(message), {statusCode}); };
export async function initializeServiceWorkflow(db) {
  await db.run(`CREATE TABLE IF NOT EXISTS service_jobs (
    order_id INTEGER PRIMARY KEY REFERENCES orders(id), worker_id INTEGER NOT NULL REFERENCES users(id),
    state TEXT NOT NULL DEFAULT 'accepted', selected_rating INTEGER, rating INTEGER,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK(state IN ('accepted','travelling','working','awaiting_customer','disputed','completed')),
    CHECK(selected_rating IS NULL OR selected_rating BETWEEN 1 AND 5),
    CHECK(rating IS NULL OR rating BETWEEN 1 AND 5))`);
}
export function reviewMarkup(id, rating) {
  return {inline_keyboard:[
    [1,2,3,4,5].map(n=>({text:(rating===n?'✅ ':'')+n+' ⭐',callback_data:'svc:star:'+id+':'+n})),
    [{text:'✅ Tasdiqlash va baholash',callback_data:'svc:confirm:'+id}],
    [{text:'⚠️ Muammo bor',callback_data:'svc:problem:'+id}]
  ]};
}
export async function serviceAction(db, actor, orderId, action, value) {
  if(!Number.isSafeInteger(orderId)||orderId<1)fail('Buyurtma noto‘g‘ri',400);
  return db.transaction(async()=>{
    const order=await db.get('SELECT o.*,c.worker_id,c.claimed_at FROM orders o JOIN work_claims c ON c.order_id=o.id WHERE o.id=?',orderId);
    if(!order||order.payment_status!=='confirmed'||order.status==='cancelled')fail('Faol xizmat buyurtmasi topilmadi',404);
    const isWorker=actor.role==='worker'&&Number(actor.id)===Number(order.worker_id);
    const isCustomer=Number(actor.id)===Number(order.customer_id);
    if(['travelling','working','finish'].includes(action)&&!isWorker)fail('Bu ish sizga biriktirilmagan',403);
    if(['star','confirm','problem','dispatch'].includes(action)&&!isCustomer)fail('Faqat buyurtma egasi tasdiqlaydi',403);
    if(!['travelling','working','finish','star','confirm','problem','dispatch'].includes(action))fail('Amal noto‘g‘ri',400);
    const claimedAt=order.claimed_at instanceof Date ? order.claimed_at.getTime() : Date.parse(String(order.claimed_at).replace(' ','T').replace(/Z?$/,'Z'));
    if(!Number.isFinite(claimedAt)||Date.now()-claimedAt<600000)fail('Biriktirish uchun 10 daqiqalik muddat tugashini kuting');
    await db.run("INSERT INTO service_jobs(order_id,worker_id,state) VALUES (?,?,'accepted') ON CONFLICT(order_id) DO NOTHING",orderId,order.worker_id);
    const job=await db.get('SELECT * FROM service_jobs WHERE order_id=?',orderId);
    if(Number(job.worker_id)!==Number(order.worker_id))fail('Usta biriktirilishi o‘zgargan');
    let next=job.state, rating=job.selected_rating;
    if(action==='travelling'){if(job.state!=='accepted')fail('Yo‘lga chiqish holati allaqachon o‘zgargan');next='travelling';}
    if(action==='working'){if(!['accepted','travelling'].includes(job.state))fail('Ishni boshlash holati noto‘g‘ri');next='working';}
    if(action==='finish'){if(job.state!=='working')fail('Avval ishni boshlang');next='awaiting_customer';}
    if(['star','confirm','problem','dispatch'].includes(action)&&job.state!=='awaiting_customer')fail('Buyurtma mijoz tasdig‘ini kutmayapti');
    if(action==='star'){rating=Number(value);if(!Number.isInteger(rating)||rating<1||rating>5)fail('1–5 yulduz tanlang',400);}
    if(action==='confirm'){if(!Number.isInteger(rating)||rating<1||rating>5)fail('Avval 1–5 yulduzdan birini tanlang',400);next='completed';}
    if(action==='dispatch')next='disputed';
    if(action==='problem')return {...job,order_number:order.order_number,showDispatcher:true};
    const changed=await db.run('UPDATE service_jobs SET state=?,selected_rating=?,rating=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND state=? AND COALESCE(selected_rating,0)=COALESCE(CAST(? AS INTEGER),0)',next,rating,next==='completed'?rating:null,orderId,job.state,job.selected_rating);
    if(!changed.changes)fail('Holat o‘zgardi. Qayta oching');
    if(next==='completed'){
      await db.run("UPDATE orders SET status='completed',updated_at=CURRENT_TIMESTAMP WHERE id=?",orderId);
      await enqueueCustomerNotification(db,{userId:order.worker_id,orderId,eventKey:'service:completed:'+orderId,title:'Ish tasdiqlandi',message:'✅ '+order.order_number+' ishini mijoz tasdiqladi. Baho: '+rating+' ⭐'});
    }
    if(['travelling','working','finish'].includes(action)){
      await enqueueCustomerNotification(db,{userId:order.customer_id,orderId,eventKey:'service:'+ (action==='finish'?'review':action)+':'+orderId,title:labels[next],message:action==='finish'?'👷 '+order.order_number+' — usta ishni tugatdi. 1–5 yulduz tanlab, tasdiqlang yoki dispetcherga murojaat qiling.':'👷 '+order.order_number+': '+labels[next]});
    }
    if(action==='dispatch'){
      const contact=await db.get('SELECT full_name,telegram_id,phone FROM users WHERE id=?',order.customer_id);
      const worker=await db.get('SELECT full_name,telegram_id FROM users WHERE id=?',order.worker_id);
      const admins=await db.all("SELECT id FROM users WHERE role IN ('admin','super_admin') AND is_active=1");
      for(const admin of admins)await enqueueCustomerNotification(db,{userId:admin.id,orderId,eventKey:'service:dispute:'+orderId+':'+admin.id,title:'Dispetcherga murojaat',message:'⚠️ '+order.order_number+' — mijoz muammo haqida xabar berdi.\nMijoz: '+contact.full_name+' (Telegram ID: '+contact.telegram_id+')\nTelefon: '+(order.delivery_phone||contact.phone||'—')+'\nUsta: '+worker.full_name+' (Telegram ID: '+worker.telegram_id+')'});
    }
    await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?,?,'service_job',?,?)",actor.id,action,String(orderId),JSON.stringify({from:job.state,to:next,rating:next==='completed'?rating:null}));
    return {order_id:orderId,state:next,selected_rating:rating,rating:next==='completed'?rating:null,order_number:order.order_number};
  });
}
export async function listServiceJobs(db,actor){
  const predicate=actor.role==='worker'?'c.worker_id=?':["admin","super_admin"].includes(actor.role)?'1=1':'o.customer_id=?';
  return db.all(`SELECT o.id,o.order_number,o.delivery_phone,o.delivery_address,o.customer_id,c.worker_id,c.claimed_at,
    COALESCE(j.state,'accepted') AS service_state,j.rating,j.selected_rating,
    u.full_name AS customer_name,u.username AS customer_username,w.full_name AS worker_name
    FROM orders o JOIN work_claims c ON c.order_id=o.id LEFT JOIN service_jobs j ON j.order_id=o.id
    JOIN users u ON u.id=o.customer_id JOIN users w ON w.id=c.worker_id
    WHERE ${predicate} AND o.payment_status='confirmed' AND o.status<>'cancelled' ORDER BY o.created_at DESC LIMIT 100`,
    ...(["admin","super_admin"].includes(actor.role)?[]:[actor.id]));
}


