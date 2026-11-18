import { createHash, randomUUID } from 'node:crypto';
import { enqueueCustomerNotification } from './customer-notifications.js';

const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode})};
const trim=(value,max)=>String(value||'').trim().slice(0,max);
export async function initializeCheckout(db){
  await db.run(`CREATE TABLE IF NOT EXISTS checkout_requests (
    telegram_id TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    submitted INTEGER NOT NULL DEFAULT 0 CHECK(submitted IN (0,1)),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(telegram_id,request_key))`);
  if(db.kind==='postgres')await db.run('ALTER TABLE checkout_requests ENABLE ROW LEVEL SECURITY');
}
export function normalizeCheckout(input){
  if(!input||!Array.isArray(input.items)||!input.items.length||input.items.length>50)fail('Savatchadagi mahsulotlarni tekshiring');
  const quantities=new Map();
  for(const line of input.items){
    const id=Number(line.id),quantity=Number(line.quantity);
    if(!Number.isSafeInteger(id)||id<1||!Number.isInteger(quantity)||quantity<1||quantity>99)fail('Mahsulot miqdorini tekshiring');
    const count=(quantities.get(id)||0)+quantity;if(count>99)fail('Bitta mahsulotdan 99 tagacha tanlang');quantities.set(id,count);
  }
  const deliveryMethod=input.deliveryMethod==='bts'?'bts':['courier','address'].includes(input.deliveryMethod)?'address':'';
  const phone=trim(input.phone,24),address=trim(input.address,500),recipientName=deliveryMethod==='bts'?trim(input.recipientName,100):'';
  if(!deliveryMethod||!/^\+?[0-9 ()-]{7,24}$/.test(phone)||phone.replace(/\D/g,'').length<7||!address||deliveryMethod==='bts'&&!recipientName)fail('Telefon, manzil va yetkazish ma’lumotlarini to‘ldiring');
  return {items:[...quantities].sort(([a],[b])=>a-b).map(([id,quantity])=>({id,quantity})),deliveryMethod,phone,address,recipientName,servicePreference:input.servicePreference==='assign_worker'?'assign_worker':'own_master'};
}
export async function checkout(db,telegramUser,input,key,phase,superAdminTelegramId='',legacy=false){
  if(!telegramUser?.id)fail('Telegram orqali kiring',401);
  if(!legacy&&!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(key||'')))fail('Mini ilovani qayta oching. To‘lovdan oldin buyurtma summasi tasdiqlanishi kerak.',426);
  if(!['prepare','submit'].includes(phase))fail('Buyurtma bosqichi noto‘g‘ri');
  const canonical=normalizeCheckout(input),fingerprint=createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),telegramId=String(telegramUser.id);
  return db.transaction(async()=>{
    // The same transaction key serializes across all server instances, not only one process.
    if(db.kind==='postgres')await db.get('SELECT pg_advisory_xact_lock(hashtext(?))','checkout:'+telegramId+':'+(legacy?'legacy:'+fingerprint:key));
    const user=await db.get('SELECT id,is_active,role FROM users WHERE telegram_id=?',telegramId);
    if(user&&!user.is_active)fail('Ushbu foydalanuvchi faolsiz',403);
    if(legacy){
      const recent=await db.get("SELECT request_key FROM checkout_requests WHERE telegram_id=? AND fingerprint=? AND request_key LIKE 'legacy:%' AND created_at>=? ORDER BY created_at DESC LIMIT 1",telegramId,fingerprint,new Date(Date.now()-600000).toISOString().slice(0,19).replace('T',' '));
      key=recent?.request_key||'legacy:'+randomUUID();
    }
    let request=await db.get('SELECT * FROM checkout_requests WHERE telegram_id=? AND request_key=?',telegramId,key),created=false;
    if(request&&request.fingerprint!==fingerprint)fail('Buyurtma tarkibi o‘zgargan. Yetkazish bosqichiga qayting va qayta tasdiqlang.',409);
    if(!request){
      if(phase!=='prepare'&&!legacy)fail('Avval to‘lov sahifasini ochib summani tasdiqlang',409);
      const rows=await db.all('SELECT id,model,name,sale_price_uzs FROM products WHERE id IN ('+canonical.items.map(()=>'?').join(',')+') AND is_active=1 AND deleted_at IS NULL',...canonical.items.map(x=>x.id));
      const products=new Map(rows.map(p=>[Number(p.id),p]));let total=0;
      const lines=canonical.items.map(line=>{
        const product=products.get(line.id);if(!product)fail('Savatchadagi mahsulotlardan biri mavjud emas',409);
        const unitPrice=Number(product.sale_price_uzs),amount=unitPrice*line.quantity;
        if(!Number.isSafeInteger(unitPrice)||unitPrice<=0||!Number.isSafeInteger(amount))fail('Mahsulot narxini tekshiring',409);
        total+=amount;return {...line,product,unitPrice,amount};
      });
      if(!Number.isSafeInteger(total)||total<1||total>1e12)fail('Buyurtma summasi ruxsat etilgan chegaradan tashqarida');
      if(legacy&&(!Number.isSafeInteger(input.total)||input.total!==total))fail('Katalog narxi yangilangan. Mini ilovani qayta oching. Agar allaqachon to‘lagan bo‘lsangiz, admin bilan bog‘laning. Summa avtomatik o‘zgartirilmadi.',409);
      const fullName=[telegramUser.first_name,telegramUser.last_name].filter(Boolean).join(' '),role=telegramId===String(superAdminTelegramId)?'super_admin':user?.role||'customer';
      await db.run("INSERT INTO users(telegram_id,username,full_name,role) VALUES (?,?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,full_name=excluded.full_name,role=CASE WHEN users.role='super_admin' OR excluded.role='super_admin' THEN 'super_admin' ELSE users.role END,updated_at=CURRENT_TIMESTAMP",telegramId,telegramUser.username||null,fullName,role);
      const customer=await db.get('SELECT id FROM users WHERE telegram_id=?',telegramId),number='UC-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+randomUUID().slice(0,8).toUpperCase();
      await db.run("INSERT INTO orders(order_number,customer_id,status,payment_status,delivery_method,recipient_name,delivery_phone,delivery_address,delivery_fee_uzs,subtotal_uzs,total_uzs,customer_note) VALUES (?,?,'pending_payment','pending',?,?,?,?,0,?,?,?)",number,customer.id,canonical.deliveryMethod,canonical.recipientName,canonical.phone,canonical.address,total,total,'service_preference='+canonical.servicePreference);
      const order=await db.get('SELECT id FROM orders WHERE order_number=?',number);
      for(const line of lines)await db.run('INSERT INTO order_items(order_id,product_id,model_snapshot,name_snapshot,quantity,unit_price_uzs,line_total_uzs) VALUES (?,?,?,?,?,?,?)',order.id,line.id,line.product.model,line.product.name,line.quantity,line.unitPrice,line.amount);
      await db.run("INSERT INTO payments(order_id,amount_uzs,method,status) VALUES (?,?,'qr','pending')",order.id,total);
      await db.run('INSERT INTO checkout_requests(telegram_id,request_key,fingerprint,order_id) VALUES (?,?,?,?)',telegramId,key,fingerprint,order.id);
      await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?,'create','order',?,?)",customer.id,number,JSON.stringify({itemCount:lines.length,totalUzs:total,deliveryMethod:canonical.deliveryMethod,stage:'payment_prepared'}));
      request={order_id:order.id,submitted:0};created=true;
    }
    let order=await db.get('SELECT id,order_number,customer_id,status,payment_status,total_uzs FROM orders WHERE id=?'+(db.kind==='postgres'?' FOR UPDATE':''),request.order_id);
    if(!order)fail('Buyurtma topilmadi',404);
    if(phase==='prepare'&&order.status==='cancelled')fail('Bu buyurtma bekor qilingan. Yangi buyurtma uchun savatchani qayta tasdiqlang.',409);
    let submittedNow=false;
    if(phase==='submit'&&!request.submitted){
      if(order.status==='cancelled')fail('Buyurtma bekor qilingan. Agar to‘lagan bo‘lsangiz, admin bilan bog‘laning.',409);
      await db.run('UPDATE checkout_requests SET submitted=1 WHERE telegram_id=? AND request_key=?',telegramId,key);
      await db.run("UPDATE orders SET payment_status='proof_submitted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND payment_status='pending'",order.id);
      await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?,'payment_submitted','order',?,?)",order.customer_id,order.order_number,JSON.stringify({totalUzs:Number(order.total_uzs)}));
      await enqueueCustomerNotification(db,{userId:order.customer_id,orderId:order.id,eventKey:'order:'+order.id+':created',title:'Buyurtma qabul qilindi',message:'🛒 '+order.order_number+' buyurtmangiz qabul qilindi. Jami: '+Number(order.total_uzs).toLocaleString('uz-UZ')+' so‘m. To‘lov admin tomonidan tekshiriladi.'});
      const admin=superAdminTelegramId?await db.get("SELECT id FROM users WHERE telegram_id=? AND role='super_admin' AND is_active=1",String(superAdminTelegramId)):null;
      if(admin)await enqueueCustomerNotification(db,{userId:admin.id,orderId:order.id,eventKey:'order:admin:'+order.id+':submitted',title:'To‘lovni tekshirish',message:'🛒 '+order.order_number+' — mijoz to‘lov qilganini bildirdi.\nJami: '+Number(order.total_uzs).toLocaleString('uz-UZ')+' so‘m.\nBuyurtmalar bo‘limida to‘lovni tekshiring.'});
      submittedNow=true;request.submitted=1;order=await db.get('SELECT id,order_number,customer_id,status,payment_status,total_uzs FROM orders WHERE id=?',order.id);
    }
    const items=await db.all('SELECT product_id AS id,model_snapshot AS model,name_snapshot AS name,quantity,unit_price_uzs AS unitPrice,line_total_uzs AS total FROM order_items WHERE order_id=? ORDER BY id',order.id);
    return {ok:true,orderNumber:order.order_number,total:Number(order.total_uzs),items,itemCount:items.length,prepared:true,submitted:Boolean(request.submitted),paymentStatus:order.payment_status,replayed:!created&&!submittedNow,message:phase==='prepare'?'To‘lov summasi serverda saqlandi.':'Buyurtma saqlandi. To‘lov admin tomonidan tekshiriladi.'};
  });
}
