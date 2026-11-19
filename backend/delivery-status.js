const fail=(message,statusCode=403)=>{throw Object.assign(new Error(message),{statusCode})};
export async function deliveryStatus(db,actor,runner){
 if(actor?.role!=='super_admin')fail('Faqat Super Admin xabarlar navbatini boshqaradi');
 const counts={pending:0,sending:0,sent:0,failed:0,superseded:0};
 const rows=await db.all("SELECT delivery_status,last_error,COUNT(*) AS n FROM customer_notifications GROUP BY delivery_status,last_error");
 for(const row of rows){const key=row.last_error==='Superseded by current order state'?'superseded':row.delivery_status;if(key in counts)counts[key]+=Number(row.n)||0;}
 const failed=await db.all("SELECT id,title,order_id,attempts,last_error,created_at FROM customer_notifications WHERE delivery_status='failed' AND COALESCE(last_error,'')<>'Superseded by current order state' ORDER BY id DESC LIMIT 20");
 return {counts,failed,runner:runner?.status()||null};
}
export async function retryNotification(db,actor,id){
 if(actor?.role!=='super_admin')fail('Faqat Super Admin xabarni qayta yuboradi');
 if(!Number.isSafeInteger(id)||id<1)fail('Xabar noto‘g‘ri',400);
 return db.transaction(async()=>{
  const changed=await db.run("UPDATE customer_notifications SET delivery_status='pending',attempts=0,next_attempt_at=?,last_error=NULL,lease_token=NULL,lease_until=NULL WHERE id=? AND delivery_status='failed' AND COALESCE(last_error,'')<>'Superseded by current order state'",new Date().toISOString().slice(0,19).replace('T',' '),id);
  if(!changed.changes)fail('Xabar holati o‘zgargan yoki u qayta yuborilmaydi',409);
  await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES (?,'retry_notification','customer_notification',?)",actor.id,String(id));return {ok:true};
 });
}
