import { categoryConfig, listCatalogCategories } from './category-management.js';
export function createProductManager(db) {

function productError(message, status = 400) { return Object.assign(new Error(message), { statusCode: status }); }
const clean = (value, length) => String(value ?? '').trim().slice(0, length);
const present = (body, field) => Object.prototype.hasOwnProperty.call(body, field);
const privateFields = ['sourcePrice', 'currency', 'rate', 'priceMode'];
const projection = `p.id, p.model, p.name, p.brand, c.name AS category, p.description, p.image_path AS image, p.sale_price_uzs AS price_uzs, p.is_active, p.deleted_at, p.updated_at`;
const privateProjection = ', p.source_price, p.source_currency, p.rate_used';
const canManage = actor => actor && ['admin', 'super_admin'].includes(actor.role);
function authorize(actor) { if (!canManage(actor)) throw productError('Admin ruxsati talab qilinadi', 403); }
async function audit(actor, action, id) { await db.run('INSERT INTO audit_log(actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)', actor.id, action, 'product', String(id)); }
async function getManagedProduct(actor, id) {
  authorize(actor);
  const row = await db.get(`SELECT ${projection}${actor.role === 'super_admin' ? privateProjection : ''} FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`, id);
  if (!row) throw productError('Mahsulot topilmadi', 404);
  return row;
}
async function listManagedProducts(actor, params) {
  authorize(actor);
  const where = [], values = [];
  const state = params.get('state') || 'all';
  if (state === 'deleted') where.push('p.deleted_at IS NOT NULL');
  else { where.push('p.deleted_at IS NULL'); if (state === 'active') where.push('p.is_active = 1'); if (state === 'hidden') where.push('p.is_active = 0'); }
  const search = clean(params.get('search'), 120);
  if (search) { where.push('(LOWER(p.name) LIKE LOWER(?) OR LOWER(p.model) LIKE LOWER(?))'); values.push('%'+search+'%', '%'+search+'%'); }
  if (params.get('brand')) { where.push('p.brand = ?'); values.push(params.get('brand')); }
  if (params.get('category')) { where.push('c.name = ?'); values.push(params.get('category')); }
  const from = 'FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE '+where.join(' AND ');
  const total = Number((await db.get('SELECT COUNT(*) AS total '+from,...values)).total);
  const pageSize = 30, page = Math.min(Math.max(1, Number.parseInt(params.get('page'), 10) || 1), Math.max(1, Math.ceil(total/pageSize)));
  const products = await db.all(`SELECT ${projection}${actor.role === 'super_admin' ? privateProjection : ''} ${from} ORDER BY p.id DESC LIMIT ? OFFSET ?`, ...values, pageSize, (page-1)*pageSize);
  const brands = (await db.all('SELECT DISTINCT brand FROM products ORDER BY brand')).map(row=>row.brand);
  const categories = await listCatalogCategories(db);
  const result = { products, total, page, pageSize, brands, categories, canManageCosts: actor.role === 'super_admin' };
  if (actor.role === 'super_admin') { const rates = {}; for (const row of await db.all('SELECT currency, rate_to_uzs FROM exchange_rates ORDER BY effective_date DESC, id DESC')) if (!rates[row.currency]) rates[row.currency] = row.rate_to_uzs; result.pricing = { markupPercent: 30, rates }; }
  return result;
}
function imagePath(value) {
  const image = clean(value, 1200);
  if (!image) return '';
  if (/^https:\/\//i.test(image)) { const url = new URL(image); if (url.username || url.password) throw productError('Rasm havolasi noto‘g‘ri'); return url.href; }
  const local = image.replace(/^\//, '');
  if (!/^(assets|uploads)\/[A-Za-z0-9_./ -]+\.(webp|png|jpe?g)$/i.test(local) || local.split('/').includes('..')) throw productError('HTTPS rasm havolasi yoki yuklangan rasmni tanlang');
  return local;
}
async function normalize(actor, body, current) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw productError('Mahsulot formati noto‘g‘ri');
  if (actor.role !== 'super_admin' && privateFields.some(field=>present(body,field))) throw productError('Tannarx sozlamalarini faqat Super Admin boshqaradi',403);
  const name=clean(body.name,300), model=clean(body.model,200), brand=clean(body.brand,80), category=categoryConfig.canonical(clean(body.category,120));
  if (!name || !model || !brand || !category) throw productError('Nom, model, brend va kategoriyani to‘ldiring');
  const image = imagePath(body.image ?? current?.image);
  if (!current && !image) throw productError('Yangi mahsulot uchun rasm kiriting');
  let price = current?.price_uzs, sourcePrice=current?.source_price ?? null, currency=current?.source_currency ?? null, rate=current?.rate_used ?? null;
  const sourceMode = actor.role === 'super_admin' && body.priceMode === 'source';
  if (sourceMode) {
    sourcePrice=Number(body.sourcePrice); currency=String(body.currency || 'USD');
    if (!Number.isFinite(sourcePrice) || sourcePrice<=0 || !['UZS','USD','EUR','CNY'].includes(currency)) throw productError('Manba narxi va valyutani tekshiring');
    rate=currency==='UZS'?1:Number(body.rate || (await db.get('SELECT rate_to_uzs FROM exchange_rates WHERE currency = ? ORDER BY effective_date DESC, id DESC LIMIT 1', currency))?.rate_to_uzs);
    if (!Number.isFinite(rate) || rate<=0) throw productError('Ushbu valyuta uchun kurs kiriting');
    price=Math.round(sourcePrice*rate*1.3);
  } else if (!current || actor.role === 'super_admin') {
    price=Number(body.salePrice ?? current?.price_uzs);
    if (actor.role === 'super_admin' && body.priceMode === 'sale') { sourcePrice=null;currency=null;rate=null; }
  } else if (present(body,'salePrice') && Number(body.salePrice)!==current.price_uzs) throw productError('Amaldagi narxni faqat Super Admin yoki kurs yangilash jarayoni o‘zgartiradi',403);
  if (!Number.isSafeInteger(price) || price<=0 || price>1e12) throw productError('Sotuv narxini to‘g‘ri kiriting');
  if (present(body,'isActive') && typeof body.isActive!=='boolean') throw productError('Mahsulot holati noto‘g‘ri');
  return {name,model,brand,category,image,description:clean(body.description,4000),price,sourcePrice,currency,rate,isActive:body.isActive ?? Boolean(current?.is_active ?? 1)};
}
async function saveManagedProduct(actor, body, id = null) {
  authorize(actor);
  try {
    return await db.transaction(async () => {
      if (id && db.kind === 'postgres') await db.get('SELECT id FROM products WHERE id = ? FOR UPDATE', id);
      const current=id?await db.get(`SELECT ${projection}${privateProjection} FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?`,id):null;
      if (id && !current) throw productError('Mahsulot topilmadi',404);
      if (current?.deleted_at) throw productError('Avval mahsulotni tiklang',409);
      const item=await normalize(actor,body,current);
      await db.run('INSERT INTO categories(name) VALUES (?) ON CONFLICT(name) DO NOTHING',item.category);
      const categoryId=(await db.get('SELECT id FROM categories WHERE name=?',item.category)).id;
      if (id) await db.run('UPDATE products SET model=?, name=?, brand=?, category_id=?, description=?, image_path=?, source_price=?, source_currency=?, rate_used=?, sale_price_uzs=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',item.model,item.name,item.brand,categoryId,item.description,item.image,item.sourcePrice,item.currency,item.rate,item.price,item.isActive?1:0,id);
      else id=Number((await db.run('INSERT INTO products(model,name,brand,category_id,description,image_path,source_price,source_currency,rate_used,sale_price_uzs,is_active,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id',item.model,item.name,item.brand,categoryId,item.description,item.image,item.sourcePrice,item.currency,item.rate,item.price,item.isActive?1:0,actor.id)).lastInsertRowid);
      await audit(actor,current?'update':'create',id);
      return getManagedProduct(actor,id);
    });
  } catch(error) {
    if ((error.code==='23505' && error.constraint==='products_model_key') || String(error.message).includes('UNIQUE constraint failed: products.model')) throw productError('Bu model allaqachon mavjud',409);
    throw error;
  }
}
async function changeProductState(actor,id,body,remove=false) {
  authorize(actor);
  return db.transaction(async()=>{
    if(db.kind==='postgres') await db.get('SELECT id FROM products WHERE id=? FOR UPDATE',id);
    const current=await getManagedProduct(actor,id);
    if(remove) { await db.run('UPDATE products SET deleted_at=CURRENT_TIMESTAMP,is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?',id);await audit(actor,'delete',id); }
    else if(body.restore===true) { await db.run('UPDATE products SET deleted_at=NULL,is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?',id);await audit(actor,'restore',id); }
    else {
      if(current.deleted_at) throw productError('Avval mahsulotni tiklang',409);
      if(typeof body.isActive!=='boolean') throw productError('Faol holatini belgilang');
      await db.run('UPDATE products SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',body.isActive?1:0,id);await audit(actor,body.isActive?'publish':'hide',id);
    }
    return getManagedProduct(actor,id);
  });
}

return {listManagedProducts,getManagedProduct,saveManagedProduct,changeProductState,productError};
}
