import { randomUUID, createHash } from 'node:crypto';
import { enqueueCustomerNotification } from './customer-notifications.js';

const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode})};
export const permissionLabels={
  'orders.read':'Buyurtmalarni ko‘rish', 'orders.manage':'Buyurtma holatini boshqarish',
  'payments.confirm':'To‘lovni tasdiqlash / rad etish', 'catalog.read':'Mahsulotlarni ko‘rish',
  'catalog.write':'Mahsulotlarni qo‘shish / tahrirlash / o‘chirish',
  'dispatch.manage':'Usta ishlari va dispetcher murojaatlari',
  'support.reply':'Mijoz savollari va javoblar', 'content.manage':'Bosh sahifa kontenti',
  'reports.export':'Buyurtmalar hisobotini yuklash'
};
export const defaultPermissions=Object.fromEntries(Object.keys(permissionLabels).map(key=>[key,true]));
export async function initializeAdminCompletion(db){
  await db.run(`CREATE TABLE IF NOT EXISTS admin_permissions(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    permissions_json TEXT NOT NULL,updated_by INTEGER REFERENCES users(id),updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  if(db.kind==='postgres')await db.run('ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY');
}
export async function attachPermissions(db,user){
  if(!user)return null;
  let permissions={};
  if(user.role==='super_admin')permissions={...defaultPermissions};
  if(user.role==='admin'){
    const row=await db.get('SELECT permissions_json FROM admin_permissions WHERE user_id=?',user.id);
    if(!row)permissions={...defaultPermissions};
    else {try{const saved=JSON.parse(row.permissions_json);permissions=Object.fromEntries(Object.keys(permissionLabels).map(k=>[k,saved[k]===true]));}catch{permissions={};}}
  }
  return {...user,permissions};
}
export const can=(user,key)=>Boolean(user&&(user.role==='super_admin'||user.role==='admin'&&user.permissions?.[key]===true));
export function requiredPermissions(path,method){
  if(path==='/api/admin/orders/export')return ['orders.read','reports.export'];
  if(/^\/api\/admin\/orders\/\d+\/payment$/.test(path))return ['orders.read','payments.confirm'];
  if(/^\/api\/admin\/orders\/\d+\/status$/.test(path))return ['orders.read','orders.manage'];
  if(path==='/api/admin/orders'||path==='/api/admin/dashboard')return ['orders.read'];
  if(path.startsWith('/api/admin/service-jobs'))return ['dispatch.manage'];
  if(path.startsWith('/api/admin/support'))return ['support.reply'];
  if(path.startsWith('/api/admin/products')||path==='/api/admin/product-images'||path==='/api/admin/categories')return [method==='GET'?'catalog.read':'catalog.write'];
  if(path==='/api/home-content'&&method!=='GET')return ['content.manage'];
  return [];
}
async function setting(db,key,fallback){const row=await db.get('SELECT value FROM settings WHERE key=?',key);if(!row)return fallback;try{return JSON.parse(row.value)}catch{fail('Saqlangan sozlamani o‘qib bo‘lmadi',500)}}
async function putSetting(db,key,value,actorId=null){await db.run('INSERT INTO settings(key,value,updated_by,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP',key,JSON.stringify(value),actorId);}
async function audit(db,actor,action,entity,id,details){await db.run('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?,?,?,?,?)',actor?.id??null,action,entity,String(id),JSON.stringify(details));}
export async function adminPermissions(db,actor,telegramId,input){
  if(actor?.role!=='super_admin')fail('Faqat Super Admin ruxsatlarni boshqaradi',403);
  const target=await db.get("SELECT id,role FROM users WHERE telegram_id=?",telegramId);
  if(!target||target.role!=='admin')fail('Admin topilmadi',404);
  if(input!==undefined){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!(k in permissionLabels))||Object.keys(permissionLabels).some(k=>typeof input[k]!=='boolean'))fail('Har bir ruxsatni tanlang');
    if(input['catalog.write']&&!input['catalog.read']||input['orders.manage']&&!input['orders.read']||input['payments.confirm']&&!input['orders.read']||input['reports.export']&&!input['orders.read'])fail('Boshqarish uchun tegishli ko‘rish ruxsatini ham yoqing');
    await db.transaction(async()=>{await db.run('INSERT INTO admin_permissions(user_id,permissions_json,updated_by) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET permissions_json=excluded.permissions_json,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP',target.id,JSON.stringify(input),actor.id);await audit(db,actor,'permissions_updated','user',target.id,input);});
  }
  return {permissions:(await attachPermissions(db,target)).permissions,labels:permissionLabels};
}
export async function resolveServiceDispute(db,actor,id,note){
  if(!can(actor,'dispatch.manage'))fail('Dispetcher ruxsati kerak',403);
  if(!Number.isSafeInteger(id)||id<1)fail('Buyurtma noto‘g‘ri');
  note=String(note||'').trim();if(!note||note.length>500)fail('Qanday hal qilinganini 1–500 belgida yozing');
  return db.transaction(async()=>{
    const order=await db.get("SELECT o.id,o.order_number,o.customer_id,o.payment_status,o.status,j.worker_id,j.state FROM orders o JOIN service_jobs j ON j.order_id=o.id JOIN work_claims c ON c.order_id=o.id AND c.worker_id=j.worker_id WHERE o.id=?",id);
    if(!order||order.payment_status!=='confirmed'||order.status==='cancelled')fail('Faol xizmat topilmadi',404);
    const changed=await db.run("UPDATE service_jobs SET state='awaiting_customer',selected_rating=NULL,rating=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND state='disputed'",id);
    if(!changed.changes)fail('Murojaat holati o‘zgargan. Sahifani yangilang',409);
    const eventId=randomUUID();
    await audit(db,actor,'resolve_dispute','service_job',id,{note,from:'disputed',to:'awaiting_customer'});
    await enqueueCustomerNotification(db,{userId:order.customer_id,orderId:id,eventKey:'service:review:'+id+':'+eventId,title:'Ishni qayta tekshiring',message:'✅ '+order.order_number+' — dispetcher murojaatni ko‘rib chiqdi.\n'+note+'\nIshni tekshirib, 1–5 yulduz tanlang va tasdiqlang. Muammo qolgan bo‘lsa yana dispetcherga murojaat qiling.'});
    await enqueueCustomerNotification(db,{userId:order.worker_id,orderId:id,eventKey:'service:resolved:'+id+':'+eventId,title:'Murojaat ko‘rib chiqildi',message:order.order_number+' — '+note+'\nMijozning qayta tasdig‘i kutilmoqda.'});
    return {ok:true,state:'awaiting_customer'};
  });
}
const csvCell=value=>'"'+String(value??'').replace(/^[\s\u0000-\u001f]*[=+\-@]/,match=>"'"+match).replaceAll('"','""')+'"';
export async function exportOrders(db,actor,params){
  if(!can(actor,'orders.read')||!can(actor,'reports.export'))fail('Hisobotga ruxsat yo‘q',403);
  const args=[],where=['1=1'];
  const status=params.get('status'),delivery=params.get('delivery'),q=String(params.get('q')||'').trim().slice(0,100);
  if(status){if(!['pending','proof_submitted','confirmed','rejected'].includes(status))fail('To‘lov holati noto‘g‘ri');where.push('o.payment_status=?');args.push(status);}
  if(delivery){if(!['address','bts'].includes(delivery))fail('Yetkazish turi noto‘g‘ri');where.push('o.delivery_method=?');args.push(delivery);}
  for(const [key,op] of [['from','>='],['to','<']]){const date=params.get(key);if(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Sana noto‘g‘ri');where.push(`o.created_at ${op} ?`);args.push(key==='to'?new Date(Date.parse(date)+86400000).toISOString().slice(0,10):date);}}
  if(params.get('from')&&params.get('to')&&params.get('from')>params.get('to'))fail('Sana oralig‘ini tekshiring');
  if(q){where.push('(LOWER(o.order_number) LIKE ? OR LOWER(u.full_name) LIKE ? OR o.delivery_phone LIKE ? OR LOWER(o.delivery_address) LIKE ? OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id=o.id AND (LOWER(oi.model_snapshot) LIKE ? OR LOWER(oi.name_snapshot) LIKE ?)))');args.push(...Array(6).fill('%'+q.toLowerCase()+'%'));}
  const rows=await db.all(`SELECT o.order_number,o.created_at,u.full_name,o.delivery_phone,o.delivery_address,o.delivery_method,o.status,o.payment_status,o.total_uzs FROM orders o JOIN users u ON u.id=o.customer_id WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC,o.id DESC LIMIT 10001`,...args);
  if(rows.length>10000)fail('10 000 dan ortiq buyurtma bor. Sana oralig‘ini qisqartiring',413);
  const fields=['order_number','created_at','full_name','delivery_phone','delivery_address','delivery_method','status','payment_status','total_uzs'];
  return '\uFEFF'+[['Buyurtma','Sana (UTC)','Mijoz','Telefon','Manzil','Yetkazish','Buyurtma holati','To‘lov holati','Jami (UZS)'],...rows.map(r=>fields.map(k=>r[k]))].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export const defaultPayment={cardNumber:'',cardHolder:'',qrImage:'/assets/paynet-payment-qr.png'};
export async function paymentSettings(db){return setting(db,'payment_settings',defaultPayment)}
export async function savePaymentSettings(db,actor,input){
  if(actor?.role!=='super_admin')fail('Faqat Super Admin',403);
  const cardNumber=String(input.cardNumber||'').replace(/\s/g,''),cardHolder=String(input.cardHolder||'').trim(),qrImage=String(input.qrImage??'');
  if(cardNumber&&!/^\d{16}$/.test(cardNumber))fail('Karta raqami 16 raqamdan iborat bo‘lsin');
  if(cardHolder.length>100||/[<>\x00-\x1f]/.test(cardHolder))fail('Karta egasini tekshiring');
  const previous=await paymentSettings(db);
  if(qrImage!==''&&qrImage!==defaultPayment.qrImage&&qrImage!==previous.qrImage)fail('QR rasmni galereyadan yuklang');
  if(!cardNumber&&!qrImage&&!input.qrBase64)fail('Karta yoki QR to‘lov usuli kerak');
  let qrData=null;
  if(input.qrBase64){
    if(typeof input.qrBase64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.qrBase64))fail('QR rasm noto‘g‘ri');
    const bytes=Buffer.from(input.qrBase64,'base64');
    if(!bytes.length||bytes.length>3*1024*1024)fail('QR rasm 3 MB dan oshmasin');
    const type=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;
    if(!type)fail('QR uchun PNG, JPG yoki WEBP rasm tanlang');
    qrData={id:randomUUID(),type,base64:input.qrBase64};
  }
  const value={cardNumber,cardHolder,qrImage:qrData?'/api/payment-qr/'+qrData.id:qrImage,updatedAt:new Date().toISOString()};
  await db.transaction(async()=>{
    if(db.kind==='postgres')await db.get('SELECT pg_advisory_xact_lock(20261118)');
    const current=await paymentSettings(db);
    if(!qrData&&qrImage.startsWith('/api/payment-qr/')&&qrImage!==current.qrImage)fail('QR rasm o‘zgargan. Rekvizitlarni qayta yuklang',409);
    if(qrData)await putSetting(db,'payment_qr',qrData,actor.id);else if(!qrImage||qrImage===defaultPayment.qrImage)await db.run("DELETE FROM settings WHERE key='payment_qr'");
    await putSetting(db,'payment_settings',value,actor.id);await audit(db,actor,'payment_settings_updated','settings','payment_settings',{cardLast4:cardNumber.slice(-4),qrImage:value.qrImage});
  });return value;
}
export const paymentQr=db=>setting(db,'payment_qr',null);
export const defaultFxOptions={automatic:true,applyPrices:false,notifySuper:false};
export async function exchangeSettings(db){return {options:await setting(db,'fx_options',defaultFxOptions),state:await setting(db,'fx_state',{rates:[],lastSuccess:null,lastAttempt:null,error:null})};}
export async function saveExchangeOptions(db,actor,input){
  if(actor?.role!=='super_admin')fail('Faqat Super Admin',403);
  if(Object.keys(defaultFxOptions).some(k=>typeof input[k]!=='boolean'))fail('Kurs parametrlarini tanlang');
  const options=Object.fromEntries(Object.keys(defaultFxOptions).map(k=>[k,input[k]]));
  await db.transaction(async()=>{await putSetting(db,'fx_options',options,actor.id);await audit(db,actor,'fx_options_updated','settings','fx_options',options);});return exchangeSettings(db);
}
export function parseCbuRates(rows){
  if(!Array.isArray(rows))fail('CBU javobi noto‘g‘ri',502);
  return ['USD','EUR','CNY'].map(code=>{
    const row=rows.find(r=>r.Ccy===code),rate=Number(row?.Rate)/Number(row?.Nominal),match=String(row?.Date||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    const date=match?`${match[3]}-${match[2]}-${match[1]}`:'';
    if(!Number.isFinite(rate)||rate<=0||rate>1e9||!match||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||Date.parse(date)<Date.now()-10*86400000||Date.parse(date)>Date.now()+7*86400000)fail('CBU kurslari yoki sanasi noto‘g‘ri',502);
    return {currency:code,rate,effectiveDate:date};
  });
}
const refreshes=new WeakMap();
export async function refreshExchange(db,actor=null,fetcher=fetch){
  if(actor&&actor.role!=='super_admin')fail('Faqat Super Admin',403);
  if(refreshes.has(db))return refreshes.get(db);
  const task=(async()=>{
    const now=new Date().toISOString();
    try{
      const response=await fetcher('https://cbu.uz/uz/arkhiv-kursov-valyut/json/',{signal:AbortSignal.timeout(10000),redirect:'error'});
      if(!response.ok)fail('CBU xizmati javob bermadi',502);
      const rates=parseCbuRates(await response.json());
      await db.transaction(async()=>{
        if(db.kind==='postgres')await db.get('SELECT pg_advisory_xact_lock(20261117)');
        const latest=await exchangeSettings(db),options=latest.options;
        for(const r of rates){
          await db.run("INSERT INTO exchange_rates(currency,rate_to_uzs,effective_date,source) VALUES (?,?,?,'CBU') ON CONFLICT(currency,effective_date,source) DO UPDATE SET rate_to_uzs=excluded.rate_to_uzs,fetched_at=CURRENT_TIMESTAMP",r.currency,r.rate,r.effectiveDate);
          if(options.applyPrices){const markup=await db.get("SELECT value FROM settings WHERE key='markup_percent'");const percent=Number(markup?.value??30);if(!Number.isFinite(percent)||percent<0||percent>300)fail('Ustama foizi noto‘g‘ri');await db.run('UPDATE products SET rate_used=?,sale_price_uzs=ROUND(source_price * ? * (1 + ? / 100.0)),updated_at=CURRENT_TIMESTAMP WHERE source_currency=? AND source_price>0 AND deleted_at IS NULL',r.rate,r.rate,percent,r.currency);}
        }
        const changed=JSON.stringify(rates)!==JSON.stringify(latest.state.rates);
        const state={rates,lastSuccess:now,lastAttempt:now,error:null};await putSetting(db,'fx_state',state,actor?.id);
        if(changed){await audit(db,actor,'fx_updated','settings','fx_state',{rates,pricesApplied:options.applyPrices});if(options.notifySuper){const admins=await db.all("SELECT id FROM users WHERE role='super_admin' AND is_active=1"),hash=createHash('sha256').update(JSON.stringify(rates)).digest('hex').slice(0,24);for(const admin of admins)await enqueueCustomerNotification(db,{userId:admin.id,eventKey:'fx:'+hash+':'+admin.id,title:'CBU kursi yangilandi',message:rates.map(r=>r.currency+': '+r.rate+' so‘m ('+r.effectiveDate+')').join('\n')+'\n'+(options.applyPrices?'Manba narxi bor mahsulotlar qayta hisoblandi.':'Mahsulot narxlari o‘zgartirilmadi.')});}}
      });
      return exchangeSettings(db);
    }catch(error){
      // Only the attempt/error fields change; a failed fetch never overwrites good rates.
      await db.transaction(async()=>{const latest=await exchangeSettings(db);await putSetting(db,'fx_state',{...latest.state,lastAttempt:now,error:'CBU kursini olish amalga oshmadi. Oxirgi to‘g‘ri kurs saqlandi.'},actor?.id);});
      throw Object.assign(new Error('CBU kursini olish amalga oshmadi. Oxirgi to‘g‘ri kurs saqlandi.'),{statusCode:502});
    }
  })();refreshes.set(db,task);try{return await task}finally{refreshes.delete(db)}
}
export async function autoRefreshExchange(db){const {options,state}=await exchangeSettings(db);if(options.automatic&&(!state.lastAttempt||Date.now()-Date.parse(state.lastAttempt)>=3600000))await refreshExchange(db);}
