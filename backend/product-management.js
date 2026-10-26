import { db } from './db.js';

export function productError(message, status = 400) { return Object.assign(new Error(message), { statusCode: status }); }
const clean = (value, length) => String(value ?? '').trim().slice(0, length);
const present = (body, field) => Object.prototype.hasOwnProperty.call(body, field);
const privateFields = ['sourcePrice', 'currency', 'rate', 'priceMode'];
const projection = `p.id, p.model, p.name, p.brand, c.name AS category, p.description, p.image_path AS image, p.sale_price_uzs AS price_uzs, p.is_active, p.deleted_at, p.updated_at`;
const privateProjection = ', p.source_price, p.source_currency, p.rate_used';
const canManage = actor => actor && ['admin', 'super_admin'].includes(actor.role);
function authorize(actor) { if (!canManage(actor)) throw productError('Admin ruxsati talab qilinadi', 403); }
function audit(actor, action, id) { db.prepare('INSERT INTO audit_log(actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)').run(actor.id, action, 'product', String(id)); }
export function getManagedProduct(actor, id) {
  authorize(actor);
  const row = db.prepare(`SELECT ${projection}${actor.role === 'super_admin' ? privateProjection : ''} FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`).get(id);
  if (!row) throw productError('Mahsulot topilmadi', 404);
  return row;
}
export function listManagedProducts(actor, params) {
  authorize(actor);
  const where = [], values = [];
  const state = params.get('state') || 'all';
  if (state === 'deleted') where.push('p.deleted_at IS NOT NULL');
  else { where.push('p.deleted_at IS NULL'); if (state === 'active') where.push('p.is_active = 1'); if (state === 'hidden') where.push('p.is_active = 0'); }
  const search = clean(params.get('search'), 120);
  if (search) { where.push('(p.name LIKE ? OR p.model LIKE ?)'); values.push('%'+search+'%', '%'+search+'%'); }
  if (params.get('brand')) { where.push('p.brand = ?'); values.push(params.get('brand')); }
  if (params.get('category')) { where.push('c.name = ?'); values.push(params.get('category')); }
  const from = 'FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE '+where.join(' AND ');
  const total = db.prepare('SELECT COUNT(*) AS total '+from).get(...values).total;
  const pageSize = 30, page = Math.min(Math.max(1, Number.parseInt(params.get('page'), 10) || 1), Math.max(1, Math.ceil(total/pageSize)));
  const products = db.prepare(`SELECT ${projection}${actor.role === 'super_admin' ? privateProjection : ''} ${from} ORDER BY p.id DESC LIMIT ? OFFSET ?`).all(...values, pageSize, (page-1)*pageSize);
  const brands = db.prepare('SELECT DISTINCT brand FROM products ORDER BY brand').all().map(row=>row.brand);
  const categories = db.prepare('SELECT name FROM categories ORDER BY name').all().map(row=>row.name);
  const result = { products, total, page, pageSize, brands, categories, canManageCosts: actor.role === 'super_admin' };
  if (actor.role === 'super_admin') { const rates = {}; for (const row of db.prepare('SELECT currency, rate_to_uzs FROM exchange_rates ORDER BY effective_date DESC, id DESC').all()) if (!rates[row.currency]) rates[row.currency] = row.rate_to_uzs; result.pricing = { markupPercent: 30, rates }; }
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
function normalize(actor, body, current) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw productError('Mahsulot formati noto‘g‘ri');
  if (actor.role !== 'super_admin' && privateFields.some(field=>present(body,field))) throw productError('Tannarx sozlamalarini faqat Super Admin boshqaradi',403);
  const name=clean(body.name,300), model=clean(body.model,200), brand=clean(body.brand,80), category=clean(body.category,120);
  if (!name || !model || !brand || !category) throw productError('Nom, model, brend va kategoriyani to‘ldiring');
  const image = imagePath(body.image ?? current?.image);
  if (!current && !image) throw productError('Yangi mahsulot uchun rasm kiriting');
  let price = current?.price_uzs, sourcePrice=current?.source_price ?? null, currency=current?.source_currency ?? null, rate=current?.rate_used ?? null;
  const sourceMode = actor.role === 'super_admin' && body.priceMode === 'source';
  if (sourceMode) {
    sourcePrice=Number(body.sourcePrice); currency=String(body.currency || 'USD');
    if (!Number.isFinite(sourcePrice) || sourcePrice<=0 || !['UZS','USD','EUR','CNY'].includes(currency)) throw productError('Manba narxi va valyutani tekshiring');
    rate=currency==='UZS'?1:Number(body.rate || db.prepare('SELECT rate_to_uzs FROM exchange_rates WHERE currency = ? ORDER BY effective_date DESC, id DESC LIMIT 1').get(currency)?.rate_to_uzs);
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
export function saveManagedProduct(actor, body, id = null) {
  authorize(actor);
  // Fetch private pricing only for internal preservation, never include it in an admin response.
  const current=id?db.prepare(`SELECT ${projection}${privateProjection} FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?`).get(id):null;
  if (id && !current) throw productError('Mahsulot topilmadi',404);
  if (current?.deleted_at) throw productError('Avval mahsulotni tiklang',409);
  const item=normalize(actor,body,current);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR IGNORE INTO categories(name) VALUES (?)').run(item.category);
    const categoryId=db.prepare('SELECT id FROM categories WHERE name=?').get(item.category).id;
    if (id) db.prepare('UPDATE products SET model=?, name=?, brand=?, category_id=?, description=?, image_path=?, source_price=?, source_currency=?, rate_used=?, sale_price_uzs=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(item.model,item.name,item.brand,categoryId,item.description,item.image,item.sourcePrice,item.currency,item.rate,item.price,item.isActive?1:0,id);
    else id=Number(db.prepare('INSERT INTO products(model,name,brand,category_id,description,image_path,source_price,source_currency,rate_used,sale_price_uzs,is_active,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(item.model,item.name,item.brand,categoryId,item.description,item.image,item.sourcePrice,item.currency,item.rate,item.price,item.isActive?1:0,actor.id).lastInsertRowid);
    audit(actor,current?'update':'create',id); db.exec('COMMIT');
  } catch(error) { db.exec('ROLLBACK'); if (String(error.message).includes('UNIQUE constraint failed: products.model')) throw productError('Bu model allaqachon mavjud',409); throw error; }
  return getManagedProduct(actor,id);
}
export function changeProductState(actor,id,body,remove=false) {
  authorize(actor);
  const current=getManagedProduct(actor,id);
  db.exec('BEGIN IMMEDIATE');
  try {
    if (remove) { db.prepare('UPDATE products SET deleted_at=CURRENT_TIMESTAMP,is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id); audit(actor,'delete',id); }
    else if(body.restore===true) { db.prepare('UPDATE products SET deleted_at=NULL,is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id); audit(actor,'restore',id); }
    else {
      if(current.deleted_at) throw productError('Avval mahsulotni tiklang',409);
      if(typeof body.isActive!=='boolean') throw productError('Faol holatini belgilang');
      db.prepare('UPDATE products SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(body.isActive?1:0,id);audit(actor,body.isActive?'publish':'hide',id);
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return getManagedProduct(actor,id);
}
