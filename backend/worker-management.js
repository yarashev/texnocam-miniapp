import {getAvailability} from './worker-availability.js';
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode})};
export const managerCan=actor=>['head_worker','super_admin'].includes(actor?.role);
const check=actor=>{if(!managerCan(actor))fail('Faqat Bosh usta yoki Super Admin boshqaradi',403)};
export async function effectiveWorkerRole(db,user){
 if(user?.role==='worker'&&await db.get('SELECT user_id FROM worker_managers WHERE user_id=?',user.id))return {...user,role:'head_worker'};
 return user;
}
export async function initializeWorkerManagement(db){
 await db.run('CREATE TABLE IF NOT EXISTS worker_managers(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
 await db.run("CREATE TABLE IF NOT EXISTS service_types(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,is_active INTEGER NOT NULL DEFAULT 1)");
 await db.run('CREATE TABLE IF NOT EXISTS worker_service_rates(worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,service_id TEXT NOT NULL REFERENCES service_types(id),price_uzs INTEGER NOT NULL CHECK(price_uzs>0),PRIMARY KEY(worker_id,service_id))');
 for(const [id,name] of [['camera-install',"Kamera o‘rnatish"],['nvr-setup','NVR sozlash'],['electrical','Elektr montaj']])await db.run('INSERT INTO service_types(id,name) VALUES (?,?) ON CONFLICT(id) DO NOTHING',id,name);
 await db.transaction(async()=>{
  if(await db.get("SELECT key FROM settings WHERE key='structured_worker_rates_v1'"))return;
  const profiles=await db.all("SELECT user_id,service_prices FROM worker_profiles WHERE service_prices<>''");
  for(const profile of profiles)for(const line of String(profile.service_prices).split(/\n/)){
   const id=/kamera|camera/i.test(line)?'camera-install':/nvr|dvr/i.test(line)?'nvr-setup':/elektr/i.test(line)?'electrical':null;
   const digits=(line.match(/[0-9][0-9.,\s]*/)||[''])[0].replace(/\D/g,'');const price=Number(digits);
   if(id&&Number.isSafeInteger(price)&&price>0&&price<=1000000000)await db.run('INSERT INTO worker_service_rates(worker_id,service_id,price_uzs) VALUES (?,?,?) ON CONFLICT(worker_id,service_id) DO NOTHING',profile.user_id,id,price);
  }
  await db.run("INSERT INTO settings(key,value) VALUES ('structured_worker_rates_v1','1') ON CONFLICT(key) DO NOTHING");
 });
}
async function worker(db,tg){
 const u=await db.get("SELECT u.* FROM users u WHERE u.telegram_id=? AND u.role='worker' AND NOT EXISTS(SELECT 1 FROM worker_managers m WHERE m.user_id=u.id)",String(tg));
 if(!u)fail('Usta topilmadi',404);return u;
}
export async function managedWorkers(db,actor){
 check(actor);
 const workers=await db.all("SELECT u.id,u.telegram_id,u.full_name,u.is_active,wp.experience_years,COALESCE(wp.phone,u.phone,'') AS phone,wp.telegram_username,wp.service_region,wp.service_city,wp.service_district,wp.is_public FROM users u LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE u.role='worker' AND NOT EXISTS(SELECT 1 FROM worker_managers m WHERE m.user_id=u.id) ORDER BY u.full_name,u.id");
 for(const u of workers){u.availability=await getAvailability(db,u.id);u.rates=await db.all('SELECT service_id,price_uzs FROM worker_service_rates WHERE worker_id=?',u.id);u.jobs=await db.all("SELECT o.order_number,CASE WHEN o.status='cancelled' THEN 'cancelled' ELSE COALESCE(j.state,'accepted') END AS state,j.rating,o.created_at FROM work_claims c JOIN orders o ON o.id=c.order_id LEFT JOIN service_jobs j ON j.order_id=o.id WHERE c.worker_id=? ORDER BY o.created_at DESC LIMIT 20",u.id)}
 return {workers,services:await db.all('SELECT id,name FROM service_types WHERE is_active=1 ORDER BY name')};
}
export async function saveManagedWorker(db,actor,body,original=null){
 check(actor);const tg=String(body.telegramId||'').trim(),name=String(body.fullName||'').trim().slice(0,100);
 if(!/^\d{5,20}$/.test(tg)||!name)fail('Telegram ID va ism-familiyani kiriting');
 const phones=String(body.phone||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(phones.length>3||phones.some(p=>!/^\+?[0-9 ()-]{7,24}$/.test(p)))fail('1–3 ta to‘g‘ri telefon raqami kiriting');
 const years=Number(body.experienceYears||0);if(!Number.isInteger(years)||years<0||years>60)fail('Staj 0–60 yil bo‘lsin');
 const username=String(body.telegramUsername||'').replace(/^@/,'');if(username&&!/^[a-zA-Z0-9_]{5,32}$/.test(username))fail('Telegram username noto‘g‘ri');
 return db.transaction(async()=>{
  let user;
  if(original){user=await worker(db,original);const duplicate=await db.get('SELECT id FROM users WHERE telegram_id=? AND id<>?',tg,user.id);if(duplicate)fail('Bu Telegram ID boshqa profilga tegishli',409);
   await db.run('UPDATE users SET telegram_id=?,full_name=?,phone=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',tg,name,phones.join(','),user.id);
  }else{
   const existing=await db.get('SELECT id,role FROM users WHERE telegram_id=?',tg);
   if(existing&&existing.role!=='customer')fail('Bu Telegram ID allaqachon xodimga tegishli',409);
   await db.run("INSERT INTO users(telegram_id,full_name,phone,role) VALUES (?,?,?,'worker') ON CONFLICT(telegram_id) DO UPDATE SET full_name=excluded.full_name,phone=excluded.phone,role='worker',is_active=1,updated_at=CURRENT_TIMESTAMP",tg,name,phones.join(','));
   user=await db.get('SELECT id FROM users WHERE telegram_id=?',tg);
  }
  const text=v=>String(v||'').trim().slice(0,80);
  await db.run('INSERT INTO worker_profiles(user_id,experience_years,phone,telegram_username,service_region,service_city,service_district,is_public) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET experience_years=excluded.experience_years,phone=excluded.phone,telegram_username=excluded.telegram_username,service_region=excluded.service_region,service_city=excluded.service_city,service_district=excluded.service_district,is_public=excluded.is_public,updated_at=CURRENT_TIMESTAMP',user.id,years,phones.join(','),username,text(body.serviceRegion),text(body.serviceCity),text(body.serviceDistrict),body.isPublic?1:0);
  await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES (?,?,'worker_profile',?)",actor.id,original?'manager_update':'manager_create',tg);
  return {ok:true};
 });
}
export async function saveWorkerRates(db,actor,tg,rates){
 check(actor);if(!Array.isArray(rates)||rates.length>50)fail('Xizmatlar ro‘yxati noto‘g‘ri');
 return db.transaction(async()=>{
 const u=await worker(db,tg),seen=new Set(),labels=[];
 for(const r of rates){const price=Number(r.price_uzs);if(seen.has(r.service_id)||!Number.isSafeInteger(price)||price<1||price>1000000000)fail('Xizmat takrorlanmasin. Narx 1–1 000 000 000 so‘m bo‘lsin');seen.add(r.service_id);
 const service=await db.get('SELECT name FROM service_types WHERE id=? AND is_active=1',String(r.service_id));if(!service)fail('Umumiy ro‘yxatdan xizmat tanlang');
 labels.push(service.name+': '+price.toLocaleString('uz-UZ')+' so‘m');
 }
 await db.run('DELETE FROM worker_service_rates WHERE worker_id=?',u.id);
 for(const r of rates)await db.run('INSERT INTO worker_service_rates(worker_id,service_id,price_uzs) VALUES (?,?,?)',u.id,r.service_id,Number(r.price_uzs));
 await db.run('UPDATE worker_profiles SET service_prices=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?',labels.join('\n'),u.id);
 await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?,'rates','worker_profile',?,?)",actor.id,String(tg),JSON.stringify(rates));
 return {ok:true};
 });
}
export async function changeManagedWorker(db,actor,tg,isActive){
 check(actor);if(typeof isActive!=='boolean')fail('Faol holatni tanlang');
 return db.transaction(async()=>{const u=await worker(db,tg);
 if(!isActive&&await db.get("SELECT c.order_id FROM work_claims c JOIN orders o ON o.id=c.order_id LEFT JOIN service_jobs j ON j.order_id=c.order_id WHERE c.worker_id=? AND o.status<>'cancelled' AND (j.state IS NULL OR j.state<>'completed') LIMIT 1",u.id))fail('Ochiq ishi bor ustani faolsizlantirib bo‘lmaydi. Yangi takliflarni to‘xtatish uchun Band qiling',409);
 await db.run('UPDATE users SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',isActive?1:0,u.id);
 await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?,'active','worker_profile',?,?)",actor.id,String(tg),JSON.stringify({isActive}));return {ok:true};});
}
export async function deleteManagedWorker(db,actor,tg){
 check(actor);return db.transaction(async()=>{
 const u=await worker(db,tg);
 if(await db.get("SELECT c.order_id FROM work_claims c JOIN orders o ON o.id=c.order_id LEFT JOIN service_jobs j ON j.order_id=c.order_id WHERE c.worker_id=? AND o.status<>'cancelled' AND (j.state IS NULL OR j.state<>'completed') LIMIT 1",u.id))fail('Ustaning ochiq ishi bor. Avval dispetcher bilan hal qiling',409);
 for(const table of ['service_jobs','work_claims','worker_ratings'])await db.run('DELETE FROM '+table+' WHERE worker_id=?',u.id);
 for(const table of ['worker_service_rates','worker_availability','worker_profiles','telegram_notification_preferences','customer_notifications'])await db.run('DELETE FROM '+table+' WHERE '+(['worker_service_rates','worker_availability'].includes(table)?'worker_id':'user_id')+'=?',u.id);
 await db.run('DELETE FROM audit_log WHERE actor_id=?',u.id);
 if(await db.get('SELECT id FROM orders WHERE customer_id=? LIMIT 1',u.id))await db.run("UPDATE users SET role='customer',phone=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",u.id);else await db.run('DELETE FROM users WHERE id=?',u.id);
 await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES (?,'manager_delete','worker_profile',?)",actor.id,String(tg));return {ok:true};
 });
}
export async function manageHeadWorker(db,actor,body,remove=false){
 if(actor?.role!=='super_admin')fail('Bosh ustani faqat Super Admin tayinlaydi',403);
 const tg=String(body.telegramId||'').trim();if(!/^\d{5,20}$/.test(tg))fail('Telegram ID kiriting');
 return db.transaction(async()=>{
 let u=await db.get('SELECT id,role FROM users WHERE telegram_id=?',tg);
 if(remove){if(!u||!await db.get('SELECT user_id FROM worker_managers WHERE user_id=?',u.id))fail('Bosh usta topilmadi',404);
 await db.run('DELETE FROM worker_managers WHERE user_id=?',u.id);if(u.role==='worker')await db.run("UPDATE users SET role='customer' WHERE id=?",u.id);
 }else{
 if(u&&!['customer','worker'].includes(u.role))fail('Admin yoki Super Admin rolini bu yerdan almashtirib bo‘lmaydi',409);
 if(u&&await db.get("SELECT c.order_id FROM work_claims c JOIN orders o ON o.id=c.order_id LEFT JOIN service_jobs j ON j.order_id=c.order_id WHERE c.worker_id=? AND o.status<>'cancelled' AND (j.state IS NULL OR j.state<>'completed') LIMIT 1",u.id))fail('Ishlari bor ustani Bosh usta qilib tayinlashdan oldin ishlarini hal qiling',409);
 if(!u){const name=String(body.fullName||'').trim().slice(0,100);if(!name)fail('Ism-familiya kiriting');await db.run("INSERT INTO users(telegram_id,full_name,role) VALUES (?,?,'worker')",tg,name);u=await db.get('SELECT id FROM users WHERE telegram_id=?',tg)}
 else await db.run("UPDATE users SET role='worker',is_active=1 WHERE id=?",u.id);
 await db.run('INSERT INTO worker_managers(user_id,created_by) VALUES (?,?) ON CONFLICT(user_id) DO NOTHING',u.id,actor.id);
 }
 await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES (?,?,'worker_manager',?)",actor.id,remove?'revoke':'grant',tg);return {ok:true};
 });
}
