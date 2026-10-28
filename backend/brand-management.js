import '../assets/catalog-brands.js';
const config=globalThis.UzCamBrandConfig;
const settingKey='catalog_brands_v1';
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const list=value=>Array.isArray(value)?value.map(item=>String(item).trim()).filter(Boolean):[];
export function normalizeCatalogBrand(input,current=null){
  if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Brend ma’lumotlarini tekshiring');
  const data={...current,...input};
  const name=String(data.name||'').trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>80)throw fail('Nom 2–80 belgidan iborat bo‘lsin');
  if(!['brand','type'].includes(data.kind))throw fail('Bo‘lim turini tanlang');
  const matchBrands=list(data.matchBrands),keywords=list(data.keywords);
  if(matchBrands.length>20||keywords.length>20||[...matchBrands,...keywords].some(value=>value.length>80))throw fail('Moslik ro‘yxati juda uzun');
  if(data.kind==='brand'&&!matchBrands.length)throw fail('Mahsulotdagi brend nomini kiriting');
  if(data.kind==='type'&&!keywords.length)throw fail('Mahsulotni aniqlaydigan kalit so‘zlarni kiriting');
  if(!config.iconNames.includes(data.icon))throw fail('Ikonkani tanlang');
  const logo=String(data.logo||'').trim();
  if(logo&&!/^\/?uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(logo)){
    if(logo.length>1200||!/^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?\/[^\s?#]*\.(png|jpe?g|webp)$/i.test(logo))throw fail('Logo uchun yuklangan PNG, JPG yoki WEBP rasmini tanlang');
  }
  const order=Number(data.order);
  if(!Number.isInteger(order)||order<0||order>9999)throw fail('Tartib 0–9999 oralig‘ida bo‘lsin');
  if(typeof data.isActive!=='boolean')throw fail('Faol holatini tanlang');
  return {id:current?.id||String(input.id||''),name,kind:data.kind,icon:data.icon,logo,order,isActive:data.isActive,matchBrands,keywords};
}
export async function listCatalogBrands(db,includeHidden=false){
  const row=await db.get('SELECT value FROM settings WHERE key=?',settingKey);
  const brands=row?JSON.parse(row.value):config.defaults.map(item=>({...item}));
  return brands.filter(item=>includeHidden||item.isActive).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name));
}
export async function saveCatalogBrand(db,actor,input,id=null,newId=null){
  if(actor?.role!=='super_admin')throw fail('Brendlarni faqat Super Admin boshqaradi',403);
  return db.transaction(async()=>{
    if(db.kind==='postgres')await db.get('SELECT pg_advisory_xact_lock(8256302)');
    const brands=await listCatalogBrands(db,true),current=id?brands.find(item=>item.id===id):null;
    if(id&&!current)throw fail('Brend topilmadi',404);
    if(!current&&brands.length>=100)throw fail('100 tadan ko‘p bo‘lim qo‘shib bo‘lmaydi');
    const item=normalizeCatalogBrand({...input,id:current?.id||newId},current);
    if(!item.id||!/^[a-z0-9-]{1,64}$/.test(item.id))throw fail('Brend identifikatori noto‘g‘ri');
    if(brands.some(other=>other.id!==item.id&&config.normalize(other.name)===config.normalize(item.name)))throw fail('Bu nomdagi brend allaqachon mavjud',409);
    const next=current?brands.map(other=>other.id===id?item:other):[...brands,item];
    await db.run('INSERT INTO settings(key,value,updated_by) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP',settingKey,JSON.stringify(next),actor.id);
    await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES (?,?,'catalog_brand',?)",actor.id,current?'update':'create',item.id);
    return item;
  });
}
export async function deleteCatalogBrand(db,actor,id){
  if(actor?.role!=='super_admin')throw fail('Brendlarni faqat Super Admin boshqaradi',403);
  return db.transaction(async()=>{
    if(db.kind==='postgres')await db.get('SELECT pg_advisory_xact_lock(8256302)');
    const brands=await listCatalogBrands(db,true),item=brands.find(brand=>brand.id===id);
    if(!item)throw fail('Brend topilmadi',404);
    // Only the navigation section is removed. Product brand values and products are preserved.
    await db.run('INSERT INTO settings(key,value,updated_by) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP',settingKey,JSON.stringify(brands.filter(brand=>brand.id!==id)),actor.id);
    await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES (?,'delete','catalog_brand',?)",actor.id,id);
    return item;
  });
}
