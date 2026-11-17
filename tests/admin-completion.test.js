import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteDatabase,createPostgresDatabase } from '../backend/database-adapters.js';
import { PGlite } from '@electric-sql/pglite';
import { initializePostgres } from '../backend/postgres-initialize.js';
import { initializeServiceWorkflow,serviceAction } from '../backend/service-workflow.js';
import { initializeAdminCompletion,attachPermissions,defaultPermissions,can,requiredPermissions,adminPermissions,resolveServiceDispute,exportOrders,paymentSettings,savePaymentSettings,paymentQr,exchangeSettings,saveExchangeOptions,refreshExchange,parseCbuRates } from '../backend/admin-completion.js';

const boss={id:3,role:'super_admin'},worker={id:2,role:'worker'},customer={id:1,role:'customer'};
async function setup(t,kind){
  let db;
  if(kind==='sqlite'){
    const engine=new DatabaseSync(':memory:');engine.exec(fs.readFileSync(new URL('../backend/schema.sql',import.meta.url),'utf8'));engine.exec('ALTER TABLE products ADD COLUMN deleted_at TEXT');db=createSqliteDatabase(engine);
  }else{
    const engine=new PGlite();await engine.waitReady;
    const execute=async(sql,values=[])=>{const r=values.length?await engine.query(sql,values):(await engine.exec(sql)).at(-1);return {rows:r?.rows||[],rowCount:r?.affectedRows??r?.rows?.length??0}};
    db=createPostgresDatabase({query:(sql,values)=>execute(sql,values),connect:async()=>({query:(sql,values)=>execute(sql,values),release(){}}),end:()=>engine.close()});await initializePostgres(db);
  }
  t.after(()=>db.close());await initializeServiceWorkflow(db);await initializeAdminCompletion(db);
  await db.run("INSERT INTO users(id,telegram_id,full_name,role) VALUES (1,'90000001','Mijoz','customer'),(2,'90000002','Usta','worker'),(3,'90000003','Boss','super_admin'),(4,'90000004','Admin','admin') ON CONFLICT(id) DO NOTHING");
  await db.run("CREATE TABLE IF NOT EXISTS work_claims(order_id INTEGER PRIMARY KEY REFERENCES orders(id),worker_id INTEGER REFERENCES users(id),claimed_at TIMESTAMP NOT NULL)");
  await db.run("INSERT INTO orders(id,order_number,customer_id,status,payment_status,delivery_method,delivery_phone,delivery_address,subtotal_uzs,total_uzs) VALUES (10,'TEST-10',1,'paid','confirmed','address','+998900000000','=HYPERLINK(1)',1000,1000)");
  await db.run("INSERT INTO work_claims(order_id,worker_id,claimed_at) VALUES (10,2,?)",new Date(Date.now()-660000).toISOString());
  return db;
}
for(const kind of ['sqlite','postgres']){
  test(kind+': granular permissions persist, cannot self-grant or grant worker roles',async t=>{
    const db=await setup(t,kind);let admin=await attachPermissions(db,{id:4,role:'admin'});assert(can(admin,'payments.confirm'));
    const permissions={...defaultPermissions,'payments.confirm':false};await adminPermissions(db,boss,'90000004',permissions);
    admin=await attachPermissions(db,{id:4,role:'admin'});assert.equal(can(admin,'payments.confirm'),false);assert(can(admin,'orders.read'));
    await assert.rejects(adminPermissions(db,admin,'90000004',defaultPermissions),/Super/);await assert.rejects(adminPermissions(db,boss,'90000002',defaultPermissions),/topilmadi/);
    await assert.rejects(adminPermissions(db,boss,'90000004',{...permissions,'orders.read':false}),/ko‘rish/);
    assert.equal(can(await attachPermissions(db,{id:2,role:'head_worker'}),'dispatch.manage'),false);
    assert.deepEqual(requiredPermissions('/api/admin/orders/export','GET'),['orders.read','reports.export']);
  });
  test(kind+': dispatcher resolution requires customer rating again, rejects duplicate and reopens another dispute',async t=>{
    const db=await setup(t,kind);await serviceAction(db,worker,10,'working');await serviceAction(db,worker,10,'finish');await serviceAction(db,customer,10,'star',2);await serviceAction(db,customer,10,'dispatch');
    await assert.rejects(resolveServiceDispute(db,worker,10,'Hal qilindi'),/ruxsati/);
    await resolveServiceDispute(db,boss,10,'Usta bilan muammo hal qilindi');
    assert.equal((await db.get('SELECT selected_rating FROM service_jobs WHERE order_id=10')).selected_rating,null);
    assert.equal((await db.get('SELECT status FROM orders WHERE id=10')).status,'paid');
    await assert.rejects(resolveServiceDispute(db,boss,10,'Takror'),/o‘zgargan/);
    await assert.rejects(serviceAction(db,customer,10,'confirm'),/yulduz/);
    await serviceAction(db,customer,10,'dispatch');await resolveServiceDispute(db,boss,10,'Qayta tekshirildi');
    assert.equal(Number((await db.get("SELECT COUNT(*) AS n FROM customer_notifications WHERE event_key LIKE 'service:review:10:%'")).n),2);
    await serviceAction(db,customer,10,'star',5);await serviceAction(db,customer,10,'confirm');assert.equal((await db.get('SELECT status FROM orders WHERE id=10')).status,'completed');
  });
  test(kind+': CSV filters and spreadsheet formula injection',async t=>{
    const db=await setup(t,kind),csv=await exportOrders(db,boss,new URLSearchParams('status=confirmed&delivery=address'));
    assert(csv.startsWith('\uFEFF'));assert(csv.includes("'+998"));assert(csv.includes("'=HYPERLINK"));
    assert(!(await exportOrders(db,boss,new URLSearchParams('status=pending'))).includes('TEST-10'));
    await assert.rejects(exportOrders(db,worker,new URLSearchParams()),/ruxsat/);await assert.rejects(exportOrders(db,boss,new URLSearchParams('from=2026-02-30')),/Sana/);
  });
  test(kind+': payment QR persisted in database; replacement deletes previous data; card-only supported',async t=>{
    const db=await setup(t,kind);const qrBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH+0AAAAASUVORK5CYII=';
    await assert.rejects(savePaymentSettings(db,worker,{cardNumber:'1'}),/Super/);
    const saved=await savePaymentSettings(db,boss,{cardNumber:'8600 0000 0000 0000',cardHolder:'Test',qrImage:'',qrBase64});
    assert.equal((await paymentSettings(db)).cardNumber,'8600000000000000');assert.match(saved.qrImage,/^\/api\/payment-qr\//);const old=await paymentQr(db);
    await savePaymentSettings(db,boss,{cardNumber:'8600000000000000',qrImage:saved.qrImage,qrBase64});assert.notEqual((await paymentQr(db)).id,old.id);
    await assert.rejects(savePaymentSettings(db,boss,{cardNumber:'bad',qrImage:''}),/16/);assert((await paymentSettings(db)).qrImage);
    await savePaymentSettings(db,boss,{cardNumber:'8600000000000000',qrImage:''});assert.equal(await paymentQr(db),null);assert.equal((await paymentSettings(db)).qrImage,'');
  });
  test(kind+': official FX parsed, retained on failure and reprices only valid foreign costs when enabled',async t=>{
    const db=await setup(t,kind),date=new Date().toISOString().slice(0,10).split('-').reverse().join('.');
    const rows=[{Ccy:'USD',Nominal:'1',Rate:'13000',Date:date},{Ccy:'EUR',Nominal:'1',Rate:'14000',Date:date},{Ccy:'CNY',Nominal:'10',Rate:'18000',Date:date}];
    const fetcher=async()=>({ok:true,json:async()=>rows});
    await db.run("INSERT INTO products(model,name,brand,source_price,source_currency,rate_used,sale_price_uzs) VALUES ('FX-USD','Test','Test',10,'USD',12000,120000),('FX-UZS','Test','Test',10,'UZS',1,10),('FX-NONE','Test','Test',NULL,NULL,NULL,77)");
    assert.equal(parseCbuRates(rows)[2].rate,1800);await refreshExchange(db,boss,fetcher);assert.equal((await db.get("SELECT sale_price_uzs FROM products WHERE model='FX-USD'")).sale_price_uzs,120000);
    await saveExchangeOptions(db,boss,{automatic:true,applyPrices:true,notifySuper:false});await refreshExchange(db,boss,fetcher);
    assert.equal((await db.get("SELECT sale_price_uzs FROM products WHERE model='FX-USD'")).sale_price_uzs,169000);
    assert.equal((await db.get("SELECT sale_price_uzs FROM products WHERE model='FX-UZS'")).sale_price_uzs,10);assert.equal((await db.get("SELECT sale_price_uzs FROM products WHERE model='FX-NONE'")).sale_price_uzs,77);
    const before=(await exchangeSettings(db)).state;await assert.rejects(refreshExchange(db,boss,async()=>{throw Error('offline')}),/Oxirgi/);const after=(await exchangeSettings(db)).state;assert.deepEqual(after.rates,before.rates);assert.equal(after.lastSuccess,before.lastSuccess);assert(after.error);
    await assert.rejects(refreshExchange(db,boss,async()=>({ok:true,json:async()=>[]})),/Oxirgi/);assert.deepEqual((await exchangeSettings(db)).state.rates,before.rates);
  });
}
