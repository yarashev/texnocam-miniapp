import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn,spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { exportSqlite } from '../backend/sqlite-snapshot.js';
const root=path.resolve('.'),token='LOCAL-TEST-NOT-PRODUCTION',superId='91000001';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function initData(id) {
  const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),query_id:'local-test',user:JSON.stringify({id:Number(id),first_name:'Sinov'})});
  const text=[...params].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>key+'='+value).join('\n');
  const secret=createHmac('sha256','WebAppData').update(token).digest();params.set('hash',createHmac('sha256',secret).update(text).digest('hex'));return params.toString();
}
async function startServer(directory) {
  const port=32000+Math.floor(Math.random()*9000),base='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',UZCAM_IMPORT_FILE:'',PORT:String(port),UZCAM_DATA_DIR:directory,TELEGRAM_BOT_TOKEN:token,SUPER_ADMIN_TELEGRAM_ID:superId,RENDER_EXTERNAL_URL:''},stdio:['ignore','pipe','pipe']});
  let log='';child.stdout.on('data',chunk=>log+=chunk);child.stderr.on('data',chunk=>log+=chunk);
  for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok) return {child,base,stop:async()=>{child.kill();await once(child,'exit');}};}catch{}if(child.exitCode!==null)break;await delay(50);}
  child.kill();throw new Error('Local server failed: '+log);
}

test('Telegram session, staff, workers, home content, uploads and restart use async database',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'uzcam-http-'));
  let running=await startServer(directory);t.after(async()=>{if(running)await running.stop();});
  let cookie='';
  async function request(route,method='GET',body) {
    const response=await fetch(running.base+route,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const value=await response.json();return {status:response.status,value,response};
  }
  assert.equal((await request('/api/admin/products')).status,403);
  let result=await request('/api/session','POST',{initData:initData(superId)});assert.equal(result.status,200);cookie=result.response.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/session')).value.user.role,'super_admin');
  assert.equal((await request('/api/staff','POST',{telegramId:'91000002',fullName:'Sinov Admin',role:'admin'})).status,201);
  const profile={telegramId:'91000003',fullName:'Sinov Usta',role:'worker',experienceYears:5,phone:'+998901234567',telegramUsername:'uzcam_test',photoUrl:'https://example.com/photo.jpg',servicePrices:'Montaj: kelishiladi',description:'Sinov',isPublic:true};
  assert.equal((await request('/api/staff','POST',profile)).status,201);
  assert.equal((await request('/api/workers')).value.workers[0].full_name,'Sinov Usta');
  assert.equal((await request('/api/workers/91000003','PUT',{...profile,fullName:'Yangilangan Usta'})).status,200);
  const content={hero:{title:'Saved Hero',productId:1,buttonText:'Ochish'},news:[{title:'Saved',body:'News',active:true}],videos:[{title:'Video',url:'https://youtu.be/abcdefghijk',active:true}]};
  assert.equal((await request('/api/home-content','PUT',content)).status,200);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=','base64');
  result=await request('/api/admin/product-images','POST',{base64:png.toString('base64')});assert.equal(result.status,201);const image=result.value.image;
  const snapshot=exportSqlite(path.join(directory,'texnocam.sqlite'),path.join(directory,'uploads'));
  assert.equal(snapshot.tables.users.length,3);assert.equal(snapshot.images.length,1);assert.equal(snapshot.tables.worker_profiles[0].experience_years,5);
  await running.stop();running=await startServer(directory);
  assert.equal((await request('/api/home-content')).value.content.hero.title,'Saved Hero');
  assert.equal((await request('/api/workers')).value.workers[0].full_name,'Yangilangan Usta');
  assert.equal((await request('/api/staff')).value.staff.length,3);
  assert.deepEqual(Buffer.from(await (await fetch(running.base+'/'+image)).arrayBuffer()),png);
});

test('Configured PostgreSQL failure stops startup without exposing URL or creating SQLite',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'uzcam-fail-'));
  const result=spawnSync(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'postgresql://test:DO-NOT-PRINT-THIS@127.0.0.1:1/postgres',UZCAM_DATA_DIR:directory},encoding:'utf8',timeout:20000});
  assert.notEqual(result.status,0);assert.doesNotMatch(result.stderr,/DO-NOT-PRINT-THIS/);assert.equal(fs.existsSync(path.join(directory,'texnocam.sqlite')),false);
});
