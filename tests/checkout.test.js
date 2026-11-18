import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {PGlite} from '@electric-sql/pglite';
import {createSqliteDatabase,createPostgresDatabase} from '../backend/database-adapters.js';
import {initializePostgres} from '../backend/postgres-initialize.js';
import {initializeCheckout,checkout} from '../backend/checkout.js';

const customer={id:91005001,first_name:'Checkout test'},other={id:91005002,first_name:'Other'};
const order={items:[{id:90001,quantity:2}],deliveryMethod:'address',phone:'+998900000000',address:'Test manzil',servicePreference:'own_master',total:1};
async function setup(t,kind){
  let db;
  if(kind==='sqlite'){const engine=new DatabaseSync(':memory:');engine.exec(fs.readFileSync(new URL('../backend/schema.sql',import.meta.url),'utf8'));engine.exec('ALTER TABLE products ADD COLUMN deleted_at TEXT');db=createSqliteDatabase(engine);}
  else{
    const engine=new PGlite();await engine.waitReady;let queue=Promise.resolve();
    const lock=async()=>{const old=queue;let release;queue=new Promise(r=>release=r);await old;return release};
    const execute=async(q,p=[])=>{const r=p.length?await engine.query(q,p):(await engine.exec(q)).at(-1);return{rows:r?.rows||[],rowCount:r?.affectedRows??r?.rows?.length??0}};
    db=createPostgresDatabase({query:async(q,p)=>{const release=await lock();try{return await execute(q,p)}finally{release()}},connect:async()=>{const release=await lock();return{query:execute,release}},end:()=>engine.close()});await initializePostgres(db);
  }
  t.after(()=>db.close());await initializeCheckout(db);
  await db.run("INSERT INTO products(id,model,name,brand,sale_price_uzs) VALUES (90001,'CHECKOUT-TEST','Test camera','Test',100000)");return db;
}
for(const kind of ['sqlite','postgres']){
  test(kind+': older open clients keep working, legacy retries deduplicate, stale prices fail explicitly',async t=>{
    const db=await setup(t,kind),input={...order,total:200000};
    const results=await Promise.all([checkout(db,customer,input,null,'submit','',true),checkout(db,customer,input,null,'submit','',true)]);
    assert.equal(results[0].orderNumber,results[1].orderNumber);assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM orders')).n),1);
    await assert.rejects(checkout(db,other,{...input,total:1},null,'submit','',true),e=>e.statusCode===409);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM orders')).n),1);
  });
  test(kind+': prepare and submit are idempotent under simultaneous retries, stored total survives catalog changes',async t=>{
    const db=await setup(t,kind),key=randomUUID();
    const prepared=await Promise.all(Array.from({length:6},()=>checkout(db,customer,order,key,'prepare')));
    assert.equal(new Set(prepared.map(p=>p.orderNumber)).size,1);assert.equal(prepared[0].total,200000);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM orders')).n),1);assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM payments')).n),1);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM customer_notifications')).n),0);
    await db.run('UPDATE products SET sale_price_uzs=999999 WHERE id=90001');
    const submitted=await Promise.all(Array.from({length:6},()=>checkout(db,customer,{...order,total:7,items:[{id:90001,quantity:2,unitPrice:3}]},key,'submit')));
    assert(submitted.every(p=>p.total===200000&&p.paymentStatus==='proof_submitted'));
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM orders')).n),1);assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM customer_notifications')).n),1);
    assert.equal(Number((await db.get("SELECT COUNT(*) AS n FROM audit_log WHERE action='payment_submitted'")).n),1);
    assert.equal((await db.get('SELECT amount_uzs FROM payments')).amount_uzs,200000);
  });
  test(kind+': key cannot change cart or owner; old client and unprepared submissions fail safely',async t=>{
    const db=await setup(t,kind),key=randomUUID();
    await assert.rejects(checkout(db,customer,order,'','prepare'),e=>e.statusCode===426);
    await assert.rejects(checkout(db,customer,order,key,'submit'),e=>e.statusCode===409);
    await checkout(db,customer,order,key,'prepare');
    await assert.rejects(checkout(db,customer,{...order,address:'Other address'},key,'submit'),e=>e.statusCode===409);
    await assert.rejects(checkout(db,other,order,key,'submit'),e=>e.statusCode===409);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM orders')).n),1);
    const fresh=await checkout(db,customer,order,randomUUID(),'prepare');assert.notEqual(fresh.orderNumber,(await checkout(db,customer,order,key,'prepare')).orderNumber);
  });
  test(kind+': canceled and deactivated orders/users stay protected; deleted product does not change prepared snapshot',async t=>{
    const db=await setup(t,kind),key=randomUUID();await checkout(db,customer,order,key,'prepare');
    await db.run('UPDATE products SET is_active=0 WHERE id=90001');const result=await checkout(db,customer,order,key,'submit');assert.equal(result.total,200000);
    await assert.rejects(checkout(db,customer,order,randomUUID(),'prepare'),e=>e.statusCode===409);
    await db.run("UPDATE users SET is_active=0 WHERE telegram_id=?",String(customer.id));await assert.rejects(checkout(db,customer,order,key,'submit'),e=>e.statusCode===403);
    await db.run("UPDATE users SET is_active=1 WHERE telegram_id=?",String(customer.id));
    await db.run("UPDATE orders SET status='cancelled' WHERE order_number=?",result.orderNumber);
    await assert.rejects(checkout(db,customer,order,key,'prepare'),e=>e.statusCode===409);
  });
  test(kind+': failures roll back all draft records and retry creates exactly one order',async t=>{
    const db=await setup(t,kind),key=randomUUID();const run=db.run;let failOnce=true;
    db.run=async(q,...p)=>{if(failOnce&&q.startsWith('INSERT INTO checkout_requests')){failOnce=false;throw Error('simulated storage failure')}return run(q,...p)};
    await assert.rejects(checkout(db,customer,order,key,'prepare'),/simulated/);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM orders')).n),0);assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM payments')).n),0);
    await checkout(db,customer,order,key,'prepare');assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM orders')).n),1);
  });
}
