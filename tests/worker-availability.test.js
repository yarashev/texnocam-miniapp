import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initializeAvailability,setAvailability,getAvailability} from '../backend/worker-availability.js';
import {availability,busyDeadline} from '../backend/worker-availability.js';
const now=Date.parse('2026-11-13T10:00:00Z');
test('expiry and manual busy status',()=>{assert.equal(availability(null,now).mode,'available');assert.equal(availability({mode:'busy',busy_until:null},now).mode,'busy');assert.equal(availability({mode:'busy',busy_until:'2026-11-13 09:59:59'},now).mode,'available');assert.equal(availability({mode:'busy',busy_until:new Date(now+1)},now).mode,'busy')});
test('one hour and Tashkent end of day',()=>{assert.equal(busyDeadline('hour',now),'2026-11-13 11:00:00');assert.equal(busyDeadline('today',now),'2026-11-13 19:00:00');assert.equal(busyDeadline('manual',now),null);assert.throws(()=>busyDeadline('invalid',now))});
async function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE users(id INTEGER PRIMARY KEY,role TEXT,is_active INTEGER); CREATE TABLE audit_log(actor_id INTEGER,action TEXT,entity_type TEXT,entity_id TEXT,details_json TEXT); INSERT INTO users VALUES(1,'worker',1),(2,'worker',1),(3,'super_admin',1),(4,'admin',1);");
 const db={get:async(q,...p)=>sql.prepare(q).get(...p),run:async(q,...p)=>sql.prepare(q).run(...p),transaction:async f=>{sql.exec('BEGIN');try{const x=await f();sql.exec('COMMIT');return x}catch(e){sql.exec('ROLLBACK');throw e}}};await initializeAvailability(db);return db;
}
test('worker controls own availability; admin and another worker denied',async()=>{const db=await setup();await assert.rejects(setAvailability(db,{id:1,role:'worker'},2,'busy','manual'),/Ruxsat/);await assert.rejects(setAvailability(db,{id:4,role:'admin'},1,'busy','manual'),/Ruxsat/);await setAvailability(db,{id:1,role:'worker'},1,'busy','manual');assert.equal((await getAvailability(db,1)).mode,'busy');await setAvailability(db,{id:1,role:'worker'},1,'available');assert.equal((await getAvailability(db,1)).mode,'available');});
test('super admin can control worker; persisted deadline expires automatically',async()=>{const db=await setup();await setAvailability(db,{id:3,role:'super_admin'},2,'busy','hour');assert.equal((await getAvailability(db,2)).mode,'busy');await db.run("UPDATE worker_availability SET busy_until='2000-01-01 00:00:00' WHERE worker_id=2");assert.equal((await getAvailability(db,2)).mode,'available');});


