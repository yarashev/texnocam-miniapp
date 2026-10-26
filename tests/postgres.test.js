import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresDatabase,postgresSql } from '../backend/database-adapters.js';
import { initializePostgres,importSnapshot,snapshotTables } from '../backend/postgres-initialize.js';
import { createProductManager } from '../backend/product-manager.js';
import { createImageStorage } from '../backend/image-storage-provider.js';

async function makeDatabase(t) {
  const engine=new PGlite();await engine.waitReady;
  // Match pg's pool/client interface while executing SQL in a real PostgreSQL WASM engine.
  let queue=Promise.resolve();
  async function lock(){const previous=queue;let unlock;queue=new Promise(resolve=>unlock=resolve);await previous;return unlock;}
  const execute=async(sql,values=[])=>{
    const result=values.length?await engine.query(sql,values):(await engine.exec(sql)).at(-1);
    return {rows:result?.rows||[],rowCount:result?.affectedRows??result?.rows?.length??0};
  };
  const pool={
    async query(sql,values){const unlock=await lock();try{return await execute(sql,values);}finally{unlock();}},
    async connect(){const unlock=await lock();return {query:execute,release:unlock};},
    end:()=>engine.close()
  };
  const db=createPostgresDatabase(pool);t.after(()=>db.close());return {db,engine};
}
const sourceProduct={name:'Sinov kamera',model:'TEST-H6C',brand:'EZVIZ',category:'Kameralar',description:'UzCam sinov',image:'assets/ezviz/01.webp',isActive:true,priceMode:'source',sourcePrice:10,currency:'USD',rate:12000};

test('SQL parameters preserve quoted question marks and ignore comments',()=>{
  assert.equal(postgresSql("SELECT '?', \"?\", ? -- ?\n, ? /* ? */"),"SELECT '?', \"?\", $1 -- ?\n, $2 /* ? */");
  assert.equal(postgresSql('INSERT OR IGNORE INTO categories(name) VALUES (?);'),'INSERT INTO categories(name) VALUES ($1) ON CONFLICT DO NOTHING');
});

test('PostgreSQL schema, seed, roles, CRUD, concurrency, images and restart persistence',async t=>{
  const {db,engine}=await makeDatabase(t);
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await initializePostgres(db);
  assert.equal(Number((await db.get('SELECT count(*) AS count FROM products')).count),2141);
  assert.equal((await db.all("SELECT * FROM pg_tables WHERE schemaname='public' AND rowsecurity=false")).length,0);
  const sequence=Number((await db.get('SELECT MAX(id) AS id FROM products')).id);
  for(const [telegram,role] of [['91000001','super_admin'],['91000002','admin'],['91000003','worker']]) await db.run('INSERT INTO users(telegram_id,role) VALUES (?,?)',telegram,role);
  const superAdmin=await db.get('SELECT * FROM users WHERE telegram_id=?','91000001');
  const admin=await db.get('SELECT * FROM users WHERE telegram_id=?','91000002');
  const worker=await db.get('SELECT * FROM users WHERE telegram_id=?','91000003');
  const products=createProductManager(db);
  const original=await products.saveManagedProduct(superAdmin,sourceProduct);
  assert.ok(original.id>sequence);assert.equal(Number(original.price_uzs),156000);
  await assert.rejects(()=>products.saveManagedProduct(superAdmin,sourceProduct),error=>error.statusCode===409);
  await assert.rejects(()=>products.saveManagedProduct(worker,sourceProduct),error=>error.statusCode===403);
  const metadata={name:'O‘zgartirildi',model:sourceProduct.model,brand:sourceProduct.brand,category:sourceProduct.category,image:sourceProduct.image,isActive:true};
  const edited=await products.saveManagedProduct(admin,metadata,original.id);
  assert.equal(edited.name,metadata.name);assert.equal(edited.source_price,undefined);
  await assert.rejects(()=>products.saveManagedProduct(admin,{...metadata,salePrice:1},original.id),error=>error.statusCode===403);
  const listing=await products.listManagedProducts(admin,new URLSearchParams('search=test-h6c'));
  assert.equal(listing.total,1);assert.equal(listing.products[0].source_price,undefined);
  const settled=await Promise.allSettled([products.saveManagedProduct(superAdmin,{...sourceProduct,model:'RACE'}),products.saveManagedProduct(superAdmin,{...sourceProduct,model:'RACE'})]);
  assert.equal(settled.filter(item=>item.status==='fulfilled').length,1);
  await products.changeProductState(admin,original.id,{},true);
  assert.equal((await products.listManagedProducts(admin,new URLSearchParams('state=deleted'))).total,1);
  await products.changeProductState(admin,original.id,{restore:true});
  assert.equal((await products.getManagedProduct(admin,original.id)).is_active,0);
  await products.changeProductState(admin,original.id,{isActive:true});
  const storage=createImageStorage(db,{}), bytes=Buffer.from('real-test-bytes');
  const image=await storage.save(bytes,'png');
  assert.equal(storage.mode(),'postgres');assert.deepEqual((await storage.load(image.split('/').at(-1))).bytes,bytes);
  await initializePostgres(db);
  assert.equal((await products.getManagedProduct(admin,original.id)).name,metadata.name);
  assert.deepEqual((await storage.load(image.split('/').at(-1))).bytes,bytes);
  await assert.rejects(()=>db.transaction(async()=>{await db.run('INSERT INTO categories(name) VALUES (?)','ROLLBACK-TEST');throw Error('Abort');}));
  assert.equal(await db.get('SELECT * FROM categories WHERE name=?','ROLLBACK-TEST'),undefined);
  // No direct Data API role can read users or supplier costs.
  await assert.rejects(()=>db.transaction(async()=>{await db.exec('SET LOCAL ROLE anon');await db.all('SELECT * FROM products');}),error=>error.code==='42501');
  await assert.rejects(()=>db.transaction(async()=>{await db.exec('SET LOCAL ROLE authenticated');await db.all('SELECT * FROM users');}),error=>error.code==='42501');
  // Deliberately empty catalogs are not repopulated on restart.
  await db.run('UPDATE products SET deleted_at=CURRENT_TIMESTAMP,is_active=0');
  await initializePostgres(db);
  assert.equal(Number((await db.get('SELECT count(*) AS count FROM products WHERE is_active=1')).count),0);
});

test('Empty PostgreSQL imports IDs, private costs, settings, chats and images; rejects overwrite',async t=>{
  const {db}=await makeDatabase(t);
  await initializePostgres(db,{catalog:{products:[]}});
  const snapshot={format:'uzcam-sqlite-v1',tables:Object.fromEntries(snapshotTables.map(table=>[table,[]])),images:[{name:'aabbccdd-1234.png',contentType:'image/png',base64:Buffer.from('saved-image').toString('base64')}]};
  snapshot.tables.users=[{id:15,telegram_id:'91000111',full_name:'Usta',role:'worker',is_active:1}];
  snapshot.tables.categories=[{id:8,name:'Kameralar'}];
  snapshot.tables.products=[{id:9000,model:'IMPORTED-CAM',name:'Imported',brand:'EZVIZ',category_id:8,source_price:10,source_currency:'USD',rate_used:12000,sale_price_uzs:156000,image_path:'uploads/aabbccdd-1234.png',is_active:1}];
  snapshot.tables.settings=[{key:'homepage_content',value:'{"news":[{"title":"Saved"}]}',updated_by:15,updated_at:'2026-10-26 00:00:00'}];
  snapshot.tables.support_threads=[{customer_telegram_id:'91000222',is_active:1}];
  snapshot.tables.support_message_links=[{admin_message_id:123,customer_telegram_id:'91000222'}];
  const summary=await importSnapshot(db,snapshot);assert.equal(summary.products,1);
  assert.equal((await db.get('SELECT source_price FROM products WHERE id=9000')).source_price,10);
  assert.equal((await db.get('SELECT customer_telegram_id FROM support_message_links WHERE admin_message_id=123')).customer_telegram_id,'91000222');
  const insert=await db.run("INSERT INTO products(model,name,brand,sale_price_uzs) VALUES ('NEXT','Next','EZVIZ',100) RETURNING id");assert.ok(insert.lastInsertRowid>9000);
  await assert.rejects(()=>importSnapshot(db,snapshot),/bo‘sh bazaga/);
  assert.equal((await db.get('SELECT name FROM products WHERE id=9000')).name,'Imported');
});

test('Storage server key uploads only to configured bucket, never falls back after failure',async t=>{
  let calls=[];
  const storage=createImageStorage({kind:'postgres',run:()=>{throw Error('unexpected database fallback');}},{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'TEST-SERVER-KEY'},async(url,init)=>{
    calls.push({url,init});return new Response(JSON.stringify(init.method?{}:{public:true}),{status:200});
  });
  await storage.initialize();const link=await storage.save(Buffer.from('image'),'webp');
  assert.match(link,/https:\/\/example.supabase.co\/storage\/v1\/object\/public\/product-images\//);
  assert.equal(calls[1].init.headers.Authorization,'Bearer TEST-SERVER-KEY');
  const failing=createImageStorage({kind:'postgres'},{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'TEST'},async()=>new Response('{}',{status:500}));
  await assert.rejects(()=>failing.save(Buffer.from('image'),'png'),/saqlay olmadi/);
});
