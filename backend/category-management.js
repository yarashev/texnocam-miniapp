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
