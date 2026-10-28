import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/catalog-brands.js';
import { normalizeCatalogBrand, listCatalogBrands, saveCatalogBrand, deleteCatalogBrand } from '../backend/brand-management.js';
const config=globalThis.UzCamBrandConfig;
const actor={id:1,role:'super_admin'};
const input={name:'EZVIZ',kind:'brand',icon:'camera',logo:'',order:12,isActive:true,matchBrands:['EZVIZ'],keywords:[]};
function database(){
  let value=null,queue=Promise.resolve();
  const history=[];
  return {
    kind:'sqlite',history,
    async get(){return value===null?undefined:{value};},
    async run(sql,...params){if(sql.startsWith('INSERT INTO settings'))value=params[1];else history.push(params);return {changes:1};},
    transaction(fn){const job=queue.then(fn);queue=job.catch(()=>{});return job;}
  };
}
test('catalog includes requested sections and matches punctuation/case aliases',()=>{
  assert.equal(config.defaults.length,12);
  const section=name=>config.defaults.find(item=>item.name===name);
  assert.ok(config.matchesSection({brand:'Hilook'},section('HiLook')));
  assert.ok(config.matchesSection({brand:'Zkteco'},section('ZKTeco')));
  assert.ok(config.matchesSection({brand:'Mikrotik'},section('Ubiquiti va MikroTik')));
  assert.ok(config.matchesSection({brand:'tp link'},section('TP-Link')));
  assert.equal(config.matchesSection({brand:'EZVIZ'},section('Hikvision')),false);
});
test('type sections avoid matching every product in the combined cable/optics category',()=>{
  const optics=config.defaults.find(item=>item.id==='optics');
  assert.equal(config.matchesSection({name:'IP kamera',category:'Kabel va optika'},optics),false);
  assert.ok(config.matchesSection({name:'SFP optical module',category:'Kabel va optika'},optics));
  assert.ok(config.matchesSection({name:'HDD 1TB'},config.defaults.find(item=>item.id==='hard-drives')));
});
test('brand validation rejects unsafe logos, invalid icons and empty matching rules',()=>{
  assert.throws(()=>normalizeCatalogBrand({...input,logo:'javascript:alert(1)'}));
  assert.throws(()=>normalizeCatalogBrand({...input,icon:'<script>'}));
  assert.throws(()=>normalizeCatalogBrand({...input,matchBrands:[]}));
  assert.throws(()=>normalizeCatalogBrand({...input,kind:'type',keywords:[]}));
  assert.throws(()=>normalizeCatalogBrand({...input,order:-1}));
  assert.equal(normalizeCatalogBrand({...input,logo:'https://demo.supabase.co/storage/v1/object/public/product-images/abc.png'}).name,'EZVIZ');
});
test('brand changes require Super Admin before any writes',async()=>{
  const db=database();
  await assert.rejects(()=>saveCatalogBrand(db,{id:2,role:'admin'},input,null,'test-brand'),{statusCode:403});
  await assert.rejects(()=>deleteCatalogBrand(db,{id:2,role:'worker'},'hikvision'),{statusCode:403});
  assert.equal(db.history.length,0);
});
test('create, edit, hide and delete persist without changing products or reseeding deleted sections',async()=>{
  const db=database();
  const created=await saveCatalogBrand(db,actor,input,null,'test-brand');
  assert.equal(created.name,'EZVIZ');
  assert.equal((await listCatalogBrands(db)).length,13);
  await saveCatalogBrand(db,actor,{name:'EZVIZ Home',isActive:false},'test-brand');
  assert.equal((await listCatalogBrands(db)).length,12);
  assert.equal((await listCatalogBrands(db,true)).find(item=>item.id==='test-brand').name,'EZVIZ Home');
  await deleteCatalogBrand(db,actor,'hikvision');
  assert.equal((await listCatalogBrands(db,true)).some(item=>item.id==='hikvision'),false);
  await deleteCatalogBrand(db,actor,'test-brand');
  assert.equal((await listCatalogBrands(db,true)).length,11);
  assert.ok(db.history.length>=4);
});
test('duplicate names and unknown IDs fail; parallel creates retain both changes',async()=>{
  const db=database();
  await assert.rejects(()=>saveCatalogBrand(db,actor,{...input,name:'HIK-VISION'},null,'duplicate'),{statusCode:409});
  await assert.rejects(()=>saveCatalogBrand(db,actor,input,'missing'),{statusCode:404});
  await Promise.all([
    saveCatalogBrand(db,actor,input,null,'first'),
    saveCatalogBrand(db,actor,{...input,name:'Dahua',matchBrands:['Dahua']},null,'second')
  ]);
  assert.equal((await listCatalogBrands(db,true)).length,14);
});
