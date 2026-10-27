import '../assets/category-config.js';
export const categoryConfig=globalThis.UzCamCategoryConfig;
const migrationKey='category_layout_20261026';

// Reassign only category references; preserve every product, price, image and visibility flag.
export async function mergeCatalogCategories(db) {
  return db.transaction(async()=>{
    if(db.kind==='postgres') await db.get('SELECT pg_advisory_xact_lock(8256301)');
    if(await db.get('SELECT 1 FROM settings WHERE key=?',migrationKey))return false;
    for(const name of categoryConfig.categories) {
      await db.run('INSERT INTO categories(name) VALUES (?) ON CONFLICT(name) DO NOTHING',name);
      await db.run('UPDATE categories SET is_active=1 WHERE name=?',name);
    }
    const moved={};
    for(const [oldName,newName] of Object.entries(categoryConfig.aliases)) {
      const oldCategory=await db.get('SELECT id FROM categories WHERE name=?',oldName);
      if(!oldCategory)continue;
      const target=await db.get('SELECT id FROM categories WHERE name=?',newName);
      const result=await db.run('UPDATE products SET category_id=? WHERE category_id=?',target.id,oldCategory.id);
      moved[oldName]=Number(result.changes);
      await db.run('UPDATE categories SET is_active=0 WHERE id=?',oldCategory.id);
    }
    await db.run('INSERT INTO settings(key,value) VALUES (?,?)',migrationKey,JSON.stringify({mergedAt:new Date().toISOString(),moved}));
    await db.run("INSERT INTO audit_log(action,entity_type,entity_id,details_json) VALUES ('merge','categories',?,?)",migrationKey,JSON.stringify(moved));
    return true;
  });
}

export async function listCatalogCategories(db) {
  const active=(await db.all('SELECT name FROM categories WHERE is_active=1 ORDER BY name')).map(row=>row.name);
  return [...categoryConfig.categories.filter(name=>active.includes(name)),...active.filter(name=>!categoryConfig.categories.includes(name))];
}

export async function listManagedCategories(db) {
  return db.all('SELECT c.name, c.is_active, COUNT(p.id) AS product_count FROM categories c LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY CASE WHEN c.is_active=1 THEN 0 ELSE 1 END, c.name');
}

export async function createCatalogCategory(db, value) {
  const raw=String(value||'').trim().replace(/\s+/g,' '),name=categoryConfig.canonical(raw);
  if(name.length<2||name.length>80||/[\/\\]/.test(name)||name.toLocaleLowerCase('uz')==='barchasi')throw Object.assign(new Error('Kategoriya nomini tekshiring'),{statusCode:400});
  return db.transaction(async()=>{
    if(db.kind==='postgres')await db.get('SELECT pg_advisory_xact_lock(8256301)');
    const existing=await db.get('SELECT name, is_active FROM categories WHERE LOWER(name)=LOWER(?)',name);
    if(existing){
      if(existing.is_active)return {name:existing.name,created:false,reactivated:false};
      await db.run('UPDATE categories SET is_active=1 WHERE LOWER(name)=LOWER(?)',name);
      return {name:existing.name,created:false,reactivated:true};
    }
    await db.run('INSERT INTO categories(name,is_active) VALUES (?,1)',name);
    return {name,created:true,reactivated:false};
  });
}

export async function deactivateCatalogCategory(db, value, replacementValue='') {
  const name=String(value||'').trim(),replacement=String(replacementValue||'').trim();
  return db.transaction(async()=>{
    if(db.kind==='postgres')await db.get('SELECT pg_advisory_xact_lock(8256301)');
    const category=await db.get('SELECT id,name,is_active FROM categories WHERE name=?',name);
    if(!category)throw Object.assign(new Error('Kategoriya topilmadi'),{statusCode:404});
    if(!category.is_active)throw Object.assign(new Error('Kategoriya allaqachon yashirilgan'),{statusCode:409});
    const count=Number((await db.get('SELECT COUNT(*) AS count FROM products WHERE category_id=?',category.id)).count);
    let target=null;
    if(count){
      if(!replacement)throw Object.assign(new Error('Bu kategoriyada mahsulotlar bor. Avval ularni boshqa faol kategoriyaga ko‘chiring.'),{statusCode:409,productCount:count});
      target=await db.get('SELECT id,name FROM categories WHERE LOWER(name)=LOWER(?) AND is_active=1',replacement);
      if(!target)throw Object.assign(new Error('Ko‘chirish uchun faol kategoriya tanlang'),{statusCode:400});
      if(target.id===category.id)throw Object.assign(new Error('Mahsulotlarni o‘chirilayotgan kategoriyaning o‘ziga ko‘chirib bo‘lmaydi'),{statusCode:400});
      await db.run('UPDATE products SET category_id=?, updated_at=CURRENT_TIMESTAMP WHERE category_id=?',target.id,category.id);
    }
    await db.run('UPDATE categories SET is_active=0 WHERE id=?',category.id);
    return {name:category.name,productCount:count,replacementCategory:target?.name||null};
  });
}
