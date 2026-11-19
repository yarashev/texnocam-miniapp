import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {PGlite} from '@electric-sql/pglite';
import {createSqliteDatabase,createPostgresDatabase} from '../backend/database-adapters.js';
import {initializePostgres} from '../backend/postgres-initialize.js';
import {initializeAvailability} from '../backend/worker-availability.js';
import {initializeWorkerManagement} from '../backend/worker-management.js';
import {initializeNotificationDelivery,recoverNotificationLeases,utc} from '../backend/notification-delivery.js';
import {initializeWorkerDelivery,enqueueWorkerOffers,finalizeWorkerClaims} from '../backend/worker-delivery.js';
import {enqueueCustomerNotification,dispatchCustomerNotifications} from '../backend/customer-notifications.js';
import {startBackgroundRunner} from '../backend/background-runner.js';
import {createTelegramClient} from '../backend/telegram-client.js';
import {utcTimeMillis} from '../backend/utc-time.js';
async function setup(t,kind){
 let db;
 if(kind==='sqlite'){const engine=new DatabaseSync(':memory:');engine.exec(fs.readFileSync(new URL('../backend/schema.sql',import.meta.url),'utf8'));engine.exec('ALTER TABLE products ADD COLUMN deleted_at TEXT');db=createSqliteDatabase(engine)}
 else{const engine=new PGlite();await engine.waitReady;let queue=Promise.resolve();const lock=async()=>{const old=queue;let release;queue=new Promise(r=>release=r);await old;return release};const execute=async(q,p=[])=>{const r=p.length?await engine.query(q,p):(await engine.exec(q)).at(-1);return{rows:r?.rows||[],rowCount:r?.affectedRows??r?.rows?.length??0}};db=createPostgresDatabase({query:async(q,p)=>{const release=await lock();try{return await execute(q,p)}finally{release()}},connect:async()=>{const release=await lock();return{query:execute,release}},end:()=>engine.close()});await initializePostgres(db)}
 t.after(()=>db.close());await initializeAvailability(db);await initializeWorkerManagement(db);await initializeNotificationDelivery(db);await initializeWorkerDelivery(db);
 await db.run("INSERT INTO users(id,telegram_id,full_name,role) VALUES (90001,'900001','Mijoz','customer'),(90002,'900002','Usta','worker'),(90003,'900003','Boshqa usta','worker')");
 for(const id of [90001,90002,90003])await db.run('INSERT INTO telegram_notification_preferences(user_id,enabled) VALUES (?,1)',id);
 await db.run("INSERT INTO orders(id,order_number,customer_id,status,payment_status,delivery_method,delivery_phone,delivery_address,subtotal_uzs,total_uzs,customer_note) VALUES (90001,'DELIVERY-TEST',90001,'paid','confirmed','address','+998900000000','PRIVATE ADDRESS',100,100,'service_preference=assign_worker')");return db;
}
for(const kind of ['sqlite','postgres']){
 if(kind==='postgres')test('postgres: legacy offset timestamps finalize at the true UTC deadline',async t=>{
  const db=await setup(t,kind),local=utc(Date.now()+5*3600000-601000)+'+05';
  await db.run('INSERT INTO work_claims(order_id,worker_id,claimed_at) VALUES (90001,90002,?)',local);await finalizeWorkerClaims(db);
  assert.equal(Number((await db.get("SELECT COUNT(*) AS n FROM customer_notifications WHERE event_key='order:90001:worker-final'")).n),1);
 });
 test(kind+': expired sends recover without resetting a live lease; last attempt terminates',async t=>{
  const db=await setup(t,kind);await enqueueCustomerNotification(db,{userId:90001,eventKey:'test:lease',message:'Test'});
  await db.run("UPDATE customer_notifications SET delivery_status='sending',lease_token='old',lease_until=?,attempts=1",utc(Date.now()+60000));
  await recoverNotificationLeases(db);assert.equal((await db.get('SELECT delivery_status FROM customer_notifications')).delivery_status,'sending');
  await db.run('UPDATE customer_notifications SET lease_until=?',utc(Date.now()-1000));await recoverNotificationLeases(db);
  let sends=0;await dispatchCustomerNotifications(db,async()=>sends++);assert.equal(sends,1);assert.equal((await db.get('SELECT delivery_status FROM customer_notifications')).delivery_status,'sent');
  await db.run("UPDATE customer_notifications SET delivery_status='sending',lease_until=?,attempts=8",utc(Date.now()-1000));await recoverNotificationLeases(db);assert.equal((await db.get('SELECT delivery_status FROM customer_notifications')).delivery_status,'failed');
 });
 test(kind+': stale acknowledgements cannot change another delivery attempt',async t=>{
  const db=await setup(t,kind);await enqueueCustomerNotification(db,{userId:90001,eventKey:'test:ownership',message:'Test'});
  await dispatchCustomerNotifications(db,async()=>{await db.run("UPDATE customer_notifications SET lease_token='new-owner' WHERE event_key='test:ownership'")});
  const row=await db.get('SELECT delivery_status,lease_token FROM customer_notifications');assert.equal(row.lease_token,'new-owner');assert.equal(row.delivery_status,'sending');
 });
 test(kind+': Telegram backoff is persisted and remaining batch is not consumed',async t=>{
  const db=await setup(t,kind);for(const key of ['one','two'])await enqueueCustomerNotification(db,{userId:90001,eventKey:'test:'+key,message:'Test'});
  let calls=0;await dispatchCustomerNotifications(db,async()=>{calls++;throw Object.assign(Error('Rate limited'),{telegramCode:429,retryAfter:180})});
  assert.equal(calls,1);const rows=await db.all('SELECT attempts,next_attempt_at FROM customer_notifications ORDER BY id');assert.equal(rows[0].attempts,1);assert(Date.parse(rows[0].next_attempt_at.replace(' ','T')+'Z')>Date.now()+170000);assert.equal(rows[1].attempts,0);
 });
 test(kind+': finalization and customer message commit together and do not run before 10 minutes',async t=>{
  const db=await setup(t,kind);await db.run('INSERT INTO work_claims(order_id,worker_id,claimed_at) VALUES (90001,90002,?)',utc(Date.now()-590000));await finalizeWorkerClaims(db);assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM customer_notifications')).n),0);
  await db.run('UPDATE work_claims SET claimed_at=?',utc(Date.now()-601000));
  const run=db.run;let failOnce=true;db.run=async(q,...p)=>{if(failOnce&&q.startsWith('INSERT INTO customer_notifications')){failOnce=false;throw Error('queue unavailable')}return run(q,...p)};
  await assert.rejects(finalizeWorkerClaims(db),/queue unavailable/);assert.equal(Number((await db.get("SELECT COUNT(*) AS n FROM audit_log WHERE action='finalized'")).n),0);
  await Promise.all([finalizeWorkerClaims(db),finalizeWorkerClaims(db)]);assert.equal(Number((await db.get("SELECT COUNT(*) AS n FROM customer_notifications WHERE event_key='order:90001:worker-final'")).n),1);assert.equal((await db.get('SELECT status FROM orders WHERE id=90001')).status,'assigned');
 });
 test(kind+': offers retry durably, contain no customer data and skip already-claimed or own-master orders',async t=>{
  const db=await setup(t,kind);await enqueueWorkerOffers(db,90001);await enqueueWorkerOffers(db,90001);assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM customer_notifications')).n),2);
  const sent=[];await dispatchCustomerNotifications(db,async(method,payload)=>{sent.push(payload);return{message_id:123}});assert.equal(sent.length,2);for(const p of sent){assert(!JSON.stringify(p).includes('PRIVATE ADDRESS'));assert(!JSON.stringify(p).includes('+998900000000'));assert.equal(p.reply_markup.inline_keyboard[0][0].callback_data,'claim:90001')}
  await db.run('INSERT INTO work_claims(order_id,worker_id,claimed_at) VALUES (90001,90002,?)',utc(Date.now()));await enqueueWorkerOffers(db,90001);assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM customer_notifications')).n),2);
  await db.run('DELETE FROM work_claims WHERE order_id=90001');await db.run("UPDATE orders SET customer_note='service_preference=own_master' WHERE id=90001");await enqueueWorkerOffers(db,90001,true);assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM customer_notifications')).n),2);
 });
 test(kind+': canceled assignment details are suppressed and a new round can offer again',async t=>{
  const db=await setup(t,kind);await enqueueWorkerOffers(db,90001);await db.run('INSERT INTO work_claims(order_id,worker_id,claimed_at) VALUES (90001,90002,?)',utc(Date.now()));
  await enqueueCustomerNotification(db,{userId:90002,orderId:90001,eventKey:'test:details',message:'Details',delivery:{kind:'details',workerId:90002}});
  await db.run('DELETE FROM work_claims WHERE order_id=90001');await enqueueWorkerOffers(db,90001,true);
  const sent=[];await dispatchCustomerNotifications(db,async(method,payload)=>{sent.push(payload);return{message_id:777}});
  assert.equal(sent.length,2);for(const p of sent)assert(!JSON.stringify(p).includes('PRIVATE ADDRESS'));
  assert.equal(Number((await db.get("SELECT COUNT(*) AS n FROM customer_notifications WHERE last_error='Superseded by current order state'")).n),3);
 });
}
test('background wakeups never overlap and graceful stop finishes the current task',async()=>{
 let release,started,active=0,maxActive=0;const began=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 const runner=startBackgroundRunner([['test',async()=>{active++;maxActive=Math.max(maxActive,active);started();await gate;active--}]],{intervalMs:60000});
 const task=runner.start();await began;runner.wake();let stopped=false;const stop=runner.stop().then(()=>stopped=true);await Promise.resolve();assert.equal(stopped,false);release();await Promise.all([task,stop]);assert.equal(maxActive,1);assert.equal(runner.status().running,false);
});
test('Telegram timeout and provider errors never expose the bot token',async()=>{
 const secret='SECRET-NOT-A-REAL-TOKEN';let signal;
 const send=createTelegramClient(secret,{timeoutMs:20,fetcher:async(url,options)=>{signal=options.signal;throw Error(url)}});await assert.rejects(send('sendMessage',{chat_id:1,text:'Test'}),e=>!e.message.includes(secret));assert(signal instanceof AbortSignal);
 const rate=createTelegramClient(secret,{fetcher:async()=>new Response(JSON.stringify({ok:false,error_code:429,parameters:{retry_after:90}}),{status:429})});await assert.rejects(rate('sendMessage',{}),e=>e.retryAfter===90&&e.telegramCode===429);assert(rate.retryAt()>Date.now()+80000);
});
test('old notification rows migrate without resetting a possibly live send on restart',async t=>{
 const engine=new DatabaseSync(':memory:'),db=createSqliteDatabase(engine);t.after(()=>db.close());
 engine.exec("CREATE TABLE customer_notifications(id INTEGER PRIMARY KEY,delivery_status TEXT,attempts INTEGER,last_error TEXT);INSERT INTO customer_notifications VALUES (1,'sending',1,NULL)");
 await initializeNotificationDelivery(db);const first=await db.get('SELECT * FROM customer_notifications');assert(first.lease_until);assert.equal(first.delivery_status,'sending');
 await initializeNotificationDelivery(db);assert.equal((await db.get('SELECT lease_until FROM customer_notifications')).lease_until,first.lease_until);
});
test('claim timestamp parsing handles PostgreSQL offsets, UTC and SQLite timestamps',()=>{
 const expected=Date.parse('2026-11-19T10:10:00.123Z');
 assert.equal(utcTimeMillis('2026-11-19 15:10:00.123456+05'),expected);
 assert.equal(utcTimeMillis('2026-11-19 06:10:00.123-04:00'),expected);
 assert.equal(utcTimeMillis('2026-11-19 10:10:00.123'),expected);
 assert.equal(utcTimeMillis(new Date(expected)),expected);assert(Number.isNaN(utcTimeMillis('invalid')));
});
