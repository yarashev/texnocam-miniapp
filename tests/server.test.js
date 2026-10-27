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
  assert.equal((await request('/api/admin/categories')).status,403);
  let result=await request('/api/session','POST',{initData:initData(superId)});assert.equal(result.status,200);cookie=result.response.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/session')).value.user.role,'super_admin');
  result=await request('/api/admin/categories');assert.equal(result.status,200);assert.ok(result.value.categories.some(category=>category.name==='Kameralar'&&category.is_active));
  result=await request('/api/admin/categories','POST',{name:'Sinov bo‘limi'});assert.equal(result.status,201);
  assert.equal((await request('/api/admin/categories','POST',{name:'Sinov bo‘limi'})).value.category.created,false);
  assert.equal((await request('/api/admin/categories','POST',{name:'Barchasi'})).status,400);
  assert.equal((await request('/api/admin/products','POST',{name:'Kategoriya sinov mahsuloti',model:'CATEGORY-API-TEST',brand:'EZVIZ',category:'Sinov bo‘limi',image:'assets/ezviz/01.webp',priceMode:'sale',salePrice:100000,isActive:true})).status,201);
  assert.equal((await request('/api/admin/categories','DELETE',{name:'Sinov bo‘limi'})).status,409);
  result=await request('/api/admin/categories','DELETE',{name:'Sinov bo‘limi',replacementCategory:'Elektronika'});assert.equal(result.status,200);assert.equal(result.value.category.productCount,1);
  assert.equal((await request('/api/products')).value.products.find(product=>product.model==='CATEGORY-API-TEST').category,'Elektronika');
  assert.equal((await request('/api/admin/categories')).value.categories.find(category=>category.name==='Sinov bo‘limi').is_active,0);
  assert.equal((await request('/api/admin/categories','POST',{name:'Sinov bo‘limi'})).value.category.reactivated,true);
  assert.equal((await request('/api/staff','POST',{telegramId:'91000002',fullName:'Sinov Admin',role:'admin'})).status,201);
  const profile={telegramId:'91000003',fullName:'Sinov Usta',role:'worker',experienceYears:5,phone:'+998901234567',serviceRegion:'Toshkent viloyati',serviceCity:'Toshkent',serviceDistrict:'Chilonzor',telegramUsername:'uzcam_test',photoUrl:'https://example.com/photo.jpg',servicePrices:'Montaj: kelishiladi',description:'Sinov',isPublic:true};
  assert.equal((await request('/api/staff','POST',profile)).status,201);
  let publicWorker=(await request('/api/workers')).value.workers[0];assert.equal(publicWorker.full_name,'Sinov Usta');assert.equal(publicWorker.service_region,'Toshkent viloyati');assert.equal(publicWorker.service_city,'Toshkent');assert.equal(publicWorker.service_district,'Chilonzor');assert.equal(publicWorker.rating_count,0);
  assert.equal((await request('/api/workers/91000003/rating','POST',{initData:initData('91000004'),rating:5})).status,200);
  let rating=(await request('/api/workers/91000003/rating','POST',{initData:initData('91000004'),rating:3})).value;assert.equal(rating.rating_average,3);assert.equal(rating.rating_count,1);
  assert.equal((await request('/api/workers/91000003/rating','POST',{initData:initData('91000005'),rating:5})).value.rating_average,4);
  assert.equal((await request('/api/workers/91000003/rating','POST',{initData:initData('91000006'),rating:6})).status,400);
  assert.equal((await request('/api/workers/91000003/rating','POST',{rating:5})).status,401);
  assert.equal((await request('/api/workers/91000003/rating','POST',{initData:initData('91000003'),rating:5})).status,403);
  assert.equal((await request('/api/workers/91000003','PUT',{...profile,fullName:'Yangilangan Usta'})).status,200);
  const content={contactPhone:'+998 50 855 41 87',hero:{title:'Saved Hero',productId:1,buttonText:'Ochish'},news:[{title:'Saved',body:'News',active:true}],videos:[{title:'Video',url:'https://youtu.be/abcdefghijk',active:true}]};
  assert.equal((await request('/api/home-content','PUT',content)).status,200);
  assert.equal((await request('/api/home-content')).value.content.contactPhone,'+998508554187');
  assert.equal((await request('/api/home-content','PUT',{...content,contactPhone:'javascript:alert(1)'})).status,400);
  assert.equal((await request('/api/home-content','PUT',{...content,contactPhone:'+998901234567'})).status,200);
  const {contactPhone:ignoredPhone,...legacyContent}=content;
  assert.equal((await request('/api/home-content','PUT',legacyContent)).status,200);
  assert.equal((await request('/api/home-content')).value.content.contactPhone,'+998901234567');
  assert.equal((await request('/api/home-content','PUT',{...content,contactPhone:''})).status,200);
  assert.equal((await request('/api/home-content')).value.content.contactPhone,'');
  await request('/api/home-content','PUT',content);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=','base64');
  result=await request('/api/admin/product-images','POST',{base64:png.toString('base64')});assert.equal(result.status,201);const image=result.value.image;
  const snapshot=exportSqlite(path.join(directory,'texnocam.sqlite'),path.join(directory,'uploads'));
  assert.equal(snapshot.tables.users.length,3);assert.equal(snapshot.images.length,1);assert.equal(snapshot.tables.worker_profiles[0].experience_years,5);assert.equal(snapshot.tables.worker_profiles[0].service_region,'Toshkent viloyati');assert.equal(snapshot.tables.worker_ratings.length,2);
  await running.stop();running=await startServer(directory);
  assert.equal((await request('/api/home-content')).value.content.hero.title,'Saved Hero');
  assert.equal((await request('/api/home-content')).value.content.contactPhone,'+998508554187');
  publicWorker=(await request('/api/workers')).value.workers[0];assert.equal(publicWorker.full_name,'Yangilangan Usta');assert.equal(publicWorker.rating_average,4);assert.equal(publicWorker.rating_count,2);
  assert.equal((await request('/api/staff')).value.staff.length,3);
  assert.deepEqual(Buffer.from(await (await fetch(running.base+'/'+image)).arrayBuffer()),png);
});

test('Configured PostgreSQL failure stops startup without exposing URL or creating SQLite',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'uzcam-fail-'));
  const result=spawnSync(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'postgresql://test:DO-NOT-PRINT-THIS@127.0.0.1:1/postgres',UZCAM_DATA_DIR:directory},encoding:'utf8',timeout:20000});
  assert.notEqual(result.status,0);assert.doesNotMatch(result.stderr,/DO-NOT-PRINT-THIS/);assert.equal(fs.existsSync(path.join(directory,'texnocam.sqlite')),false);
});
