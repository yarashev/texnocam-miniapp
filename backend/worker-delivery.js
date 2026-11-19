import {enqueueCustomerNotification} from './customer-notifications.js';
import {utcTimeMillis} from './utc-time.js';
const utc=value=>new Date(value).toISOString().slice(0,19).replace('T',' ');
export async function initializeWorkerDelivery(db){
  await db.run('CREATE TABLE IF NOT EXISTS worker_offer_rounds(order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,generation INTEGER NOT NULL DEFAULT 0)');
  if(db.kind==='postgres')await db.run('ALTER TABLE worker_offer_rounds ENABLE ROW LEVEL SECURITY');
}
export async function enqueueWorkerOffers(db,orderId,newRound=false,inTransaction=false){
  const run=async()=>{
    if(db.kind==='postgres')await db.get('SELECT pg_advisory_xact_lock(hashtext(?))','worker-offers:'+orderId);
    const order=await db.get("SELECT id,order_number,payment_status,status,customer_note FROM orders WHERE id=?",orderId);
    if(!order||order.payment_status!=='confirmed'||order.status==='cancelled'||!String(order.customer_note).includes('service_preference=assign_worker')||await db.get('SELECT order_id FROM work_claims WHERE order_id=?',orderId))return;
    await db.run('INSERT INTO worker_offer_rounds(order_id) VALUES (?) ON CONFLICT(order_id) DO NOTHING',orderId);
    if(newRound)await db.run('UPDATE worker_offer_rounds SET generation=generation+1 WHERE order_id=?',orderId);
    const {generation}=await db.get('SELECT generation FROM worker_offer_rounds WHERE order_id=?',orderId);
    const workers=await db.all("SELECT u.id FROM users u JOIN telegram_notification_preferences n ON n.user_id=u.id AND n.enabled=1 LEFT JOIN worker_availability a ON a.worker_id=u.id WHERE u.role='worker' AND u.is_active=1 AND NOT EXISTS(SELECT 1 FROM worker_managers m WHERE m.user_id=u.id) AND (a.mode IS NULL OR a.mode='available' OR (a.busy_until IS NOT NULL AND a.busy_until<=CURRENT_TIMESTAMP))");
    const items=await db.all('SELECT name_snapshot,quantity FROM order_items WHERE order_id=?',orderId);
    const message='🔧 Yangi xizmat buyurtmasi\n\nBuyurtma: '+order.order_number+'\nMahsulotlar: '+items.map(i=>i.name_snapshot+' × '+i.quantity).join(', ')+'\n\nBirinchi qabul qilgan ustaga biriktiriladi.';
    for(const worker of workers)await enqueueCustomerNotification(db,{userId:worker.id,orderId,eventKey:'worker:offer:'+orderId+':'+generation+':'+worker.id,title:'Yangi xizmat buyurtmasi',message,delivery:{kind:'offer',generation}});
  };return inTransaction?run():db.transaction(run);
}
export async function enqueueOfferCleanup(db,orderId,claimedWorkerId,key){
  const offers=await db.all("SELECT actor_id,details_json FROM audit_log WHERE entity_type='worker_offer' AND entity_id=? AND action='offer_sent'",String(orderId));
  for(const offer of offers){
    if(Number(offer.actor_id)===Number(claimedWorkerId))continue;
    let meta;try{meta=JSON.parse(offer.details_json)}catch{continue}
    if(!Number.isSafeInteger(Number(meta.messageId)))continue;
    await enqueueCustomerNotification(db,{userId:offer.actor_id,orderId,eventKey:'worker:cleanup:'+key+':'+offer.actor_id+':'+meta.messageId,title:'Taklif yangilandi',message:'Taklif tugmasi yopildi',delivery:{kind:'edit',messageId:Number(meta.messageId),replyMarkup:{inline_keyboard:[]}}});
  }
}
export async function prepareWorkerDelivery(db,row,delivery){
  if(delivery.kind==='edit')return {method:'editMessageReplyMarkup',payload:{chat_id:row.telegram_id,message_id:delivery.messageId,reply_markup:delivery.replyMarkup}};
  const order=await db.get('SELECT o.*,c.worker_id,c.claimed_at FROM orders o LEFT JOIN work_claims c ON c.order_id=o.id WHERE o.id=?',row.order_id);
  if(!order||order.payment_status!=='confirmed'||['cancelled','completed'].includes(order.status))return null;
  if(delivery.kind==='offer'){
    const round=await db.get('SELECT generation FROM worker_offer_rounds WHERE order_id=?',order.id);
    const worker=await db.get("SELECT u.id FROM users u LEFT JOIN worker_availability a ON a.worker_id=u.id WHERE u.id=? AND u.role='worker' AND u.is_active=1 AND NOT EXISTS(SELECT 1 FROM worker_managers m WHERE m.user_id=u.id) AND (a.mode IS NULL OR a.mode='available' OR (a.busy_until IS NOT NULL AND a.busy_until<=CURRENT_TIMESTAMP))",row.user_id);
    if(order.worker_id||!worker||Number(round?.generation)!==Number(delivery.generation))return null;
    return {method:'sendMessage',payload:{chat_id:row.telegram_id,text:row.message,reply_markup:{inline_keyboard:[[{text:'✅ Qabul qilish',callback_data:'claim:'+order.id}]]}}};
  }
  if(delivery.kind==='customer-assigned')return order.status!=='completed'&&Number(order.worker_id)===Number(delivery.workerId)&&Number(order.customer_id)===Number(row.user_id)?{method:'sendMessage',payload:{chat_id:row.telegram_id,text:row.message}}:null;
  if(Number(order.worker_id)!==Number(delivery.workerId))return null;
  if(delivery.kind==='details'){
    if(Number(order.worker_id)!==Number(row.user_id))return null;
    const customer=await db.get('SELECT full_name,username FROM users WHERE id=?',order.customer_id);
    return {method:'sendMessage',payload:{chat_id:row.telegram_id,text:'📋 '+order.order_number+' buyurtma tafsilotlari\nMijoz: '+customer.full_name+'\nTelefon: '+order.delivery_phone+'\nTelegram: '+(customer.username?'@'+customer.username:'Telegram username kiritilmagan')+'\nManzil: '+order.delivery_address}};
  }
  if(delivery.kind==='claim-message'){
    const at=utcTimeMillis(order.claimed_at);
    const keyboard=Date.now()-at<600000?[[{text:'Bekor qilish (10 daqiqa)',callback_data:'cancel:'+order.id}]]:[];
    keyboard.push([{text:'Usta kabinetini ochish',web_app:{url:delivery.appUrl+'assets/worker-cabinet.html'}}]);
    return {method:'editMessageText',payload:{chat_id:row.telegram_id,message_id:delivery.messageId,text:'✅ '+order.order_number+' sizga biriktirildi.'+(keyboard.length>1?' 10 daqiqa ichida bekor qilishingiz mumkin.':''),reply_markup:{inline_keyboard:keyboard}}};
  }
  if(delivery.kind==='assigned-notice')return {method:'sendMessage',payload:{chat_id:row.telegram_id,text:row.message}};
  return null;
}
export async function recordWorkerDelivery(db,row,delivery,result){
  if(delivery.kind!=='offer'||!Number.isSafeInteger(Number(result?.message_id)))return;
  await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?,'offer_sent','worker_offer',?,?)",row.user_id,String(row.order_id),JSON.stringify({chatId:row.telegram_id,messageId:result.message_id}));
  const claim=await db.get('SELECT worker_id FROM work_claims WHERE order_id=?',row.order_id);
  if(claim)await enqueueOfferCleanup(db,row.order_id,claim.worker_id,'late:'+row.id);
  const round=await db.get('SELECT generation FROM worker_offer_rounds WHERE order_id=?',row.order_id);
  if(Number(round?.generation)!==Number(delivery.generation))await enqueueCustomerNotification(db,{userId:row.user_id,orderId:row.order_id,eventKey:'worker:late-expired:'+row.id,title:'Taklif yangilandi',message:'Oldingi taklif tugmasi yopildi',delivery:{kind:'edit',messageId:Number(result.message_id),replyMarkup:{inline_keyboard:[]}}});
}
export async function finalizeWorkerClaims(db){
  const cutoff=db.kind==='postgres'?new Date(Date.now()-600000).toISOString():utc(Date.now()-600000);
  const age=db.kind==='postgres'?"(CASE WHEN c.claimed_at ~ '(Z|[+-][0-9]{2}(:?[0-9]{2})?)$' THEN CAST(c.claimed_at AS TIMESTAMPTZ) ELSE CAST(c.claimed_at AS TIMESTAMP) AT TIME ZONE 'UTC' END)<=CAST(? AS TIMESTAMPTZ)":"c.claimed_at<=?";
  const claims=await db.all("SELECT c.order_id,c.worker_id FROM work_claims c JOIN orders o ON o.id=c.order_id WHERE "+age+" AND o.payment_status='confirmed' AND o.status NOT IN ('cancelled','completed') AND NOT EXISTS(SELECT 1 FROM customer_notifications n WHERE n.event_key='order:'||CAST(c.order_id AS TEXT)||':worker-final') ORDER BY c.claimed_at LIMIT 20",cutoff);
  for(const candidate of claims)await db.transaction(async()=>{
    if(db.kind==='postgres')await db.get('SELECT pg_advisory_xact_lock(hashtext(?))','worker-claim:'+candidate.order_id);
    const claim=await db.get("SELECT c.order_id,c.worker_id,o.order_number,o.customer_id,u.full_name,u.phone,u.username FROM work_claims c JOIN orders o ON o.id=c.order_id JOIN users u ON u.id=c.worker_id WHERE c.order_id=? AND c.worker_id=? AND "+age+" AND o.payment_status='confirmed' AND o.status NOT IN ('cancelled','completed')"+(db.kind==='postgres'?' FOR UPDATE OF c':''),candidate.order_id,candidate.worker_id,cutoff);
    if(!claim||await db.get('SELECT id FROM customer_notifications WHERE event_key=?','order:'+claim.order_id+':worker-final'))return;
    if(!await db.get("SELECT actor_id FROM audit_log WHERE entity_type='work_claim' AND entity_id=? AND action='finalized'",String(claim.order_id)))await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?,'finalized','work_claim',?,'{}')",claim.worker_id,String(claim.order_id));
    await enqueueCustomerNotification(db,{userId:claim.customer_id,orderId:claim.order_id,eventKey:'order:'+claim.order_id+':worker-final',title:'Usta biriktirildi',message:'👷 Ustangiz biriktirildi.\nUsta: '+claim.full_name+'\nTelefon: '+(claim.phone||'—')+(claim.username?'\nTelegram: @'+claim.username:'')+'\nTez orada usta siz bilan bog‘lanadi.',delivery:{kind:'customer-assigned',workerId:claim.worker_id}});
    await db.run("UPDATE orders SET status='assigned',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='paid'",claim.order_id);
    await enqueueOfferCleanup(db,claim.order_id,claim.worker_id,'final:'+claim.order_id);
    const peers=await db.all("SELECT DISTINCT actor_id FROM audit_log WHERE entity_type='worker_offer' AND entity_id=? AND action='offer_sent' AND actor_id<>?",String(claim.order_id),claim.worker_id);
    for(const peer of peers)await enqueueCustomerNotification(db,{userId:peer.actor_id,orderId:claim.order_id,eventKey:'worker:final-notice:'+claim.order_id+':'+peer.actor_id,title:'Usta biriktirildi',message:'ℹ️ '+claim.order_number+' buyurtmaga boshqa usta biriktirildi.',delivery:{kind:'assigned-notice',workerId:claim.worker_id}});
    const notice=await db.get("SELECT details_json FROM audit_log WHERE entity_type='work_claim' AND entity_id=? AND action='claim_notice' ORDER BY created_at DESC LIMIT 1",String(claim.order_id));
    if(notice){let meta;try{meta=JSON.parse(notice.details_json)}catch{}if(meta)await enqueueCustomerNotification(db,{userId:claim.worker_id,orderId:claim.order_id,eventKey:'worker:close-cancel:'+claim.order_id,title:'Biriktirish yakunlandi',message:'Bekor qilish muddati tugadi',delivery:{kind:'edit',messageId:meta.messageId,replyMarkup:{inline_keyboard:[[{text:'Usta kabinetini ochish',web_app:{url:meta.appUrl+'assets/worker-cabinet.html'}}]]}}});}
  });
}

