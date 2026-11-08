import { mergeCatalogCategories, listCatalogCategories } from './category-management.js';
import { postgresTls } from './postgres-tls.js';
import { createPostgresDatabase, createSqliteDatabase } from './database-adapters.js';
import { initializePostgres } from './postgres-initialize.js';
import { importDahuaCatalog } from './dahua-import.js';
import { normalizeProductCategories } from './product-classification.js';

export async function connectDatabase(env = process.env) {
  if (!env.DATABASE_URL) {
    const { db: sqlite } = await import('./db.js');
    return createSqliteDatabase(sqlite);
  }
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error('DATABASE_URL formatini tekshiring'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.password || /\[YOUR-PASSWORD\]/i.test(decodeURIComponent(url.password))) {
    throw new Error('DATABASE_URL uchun to‘liq PostgreSQL manzili va baza paroli talab qilinadi');
  }
  // Do not let connection-string SSL options disable certificate verification.
  for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(name);
  const { Pool, types } = await import('pg');
  const pool = new Pool({
    connectionString: url.href,
    ssl: postgresTls(url.hostname,env),
    types: { getTypeParser: (oid,format) => oid === 20 ? value => { const number=Number(value);if(!Number.isSafeInteger(number))throw new Error('Integer exceeds safe JavaScript range');return number; } : types.getTypeParser(oid,format) },
    max: 3, connectionTimeoutMillis: 15000, idleTimeoutMillis: 30000,
    statement_timeout: 30000, application_name: 'uzcam'
  });
  pool.on('error', () => console.error('PostgreSQL background connection failed'));
  const database = createPostgresDatabase(pool);
  try { await database.get('SELECT 1 AS ready'); return database; }
  catch (error) { await pool.end(); throw Object.assign(new Error('PostgreSQL ulanishi amalga oshmadi; DATABASE_URL, parol va loyiha holatini tekshiring'), { code: error.code }); }
}

// A configured PostgreSQL outage must never create a fresh SQLite database.
export const db = await connectDatabase();
if (db.kind === 'postgres') {
  try { await initializePostgres(db); }
  catch (error) { await db.close(); throw Object.assign(new Error('PostgreSQL bazasini tayyorlab bo‘lmadi; migratsiya va ulanish sozlamalarini tekshiring'), { code: error.code }); }
}

await mergeCatalogCategories(db);
await importDahuaCatalog(db);
await normalizeProductCategories(db);
export const listPublicCategories=()=>listCatalogCategories(db);

export async function listPublicProducts() {
  // Keep the storefront catalog independent from optional analytics tables.
  // A missing analytics migration must never make every product disappear.
  const products = await db.all(`SELECT p.id, p.model, p.name, p.brand, c.name AS category,
    p.description, p.image_path AS image, p.sale_price_uzs AS price_uzs,
    0 AS views, 0 AS cart_adds, 0 AS sold_qty
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND p.deleted_at IS NULL ORDER BY p.brand, p.model`);

  const byId = new Map(products.map(product => [String(product.id), product]));
  try {
    const events = await db.all(`SELECT entity_id, action, COUNT(*) AS total
      FROM audit_log
      WHERE entity_type = 'analytics' AND action IN ('product_view', 'add_to_cart')
      GROUP BY entity_id, action`);
    for (const event of events) {
      const product = byId.get(String(event.entity_id));
      if (!product) continue;
      if (event.action === 'product_view') product.views = Number(event.total) || 0;
      if (event.action === 'add_to_cart') product.cart_adds = Number(event.total) || 0;
    }
  } catch (error) {
    console.error('Catalog analytics unavailable; products remain available:', error.message);
  }
  try {
    const sales = await db.all(`SELECT oi.product_id, SUM(oi.quantity) AS sold_qty
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_status = 'confirmed' GROUP BY oi.product_id`);
    for (const sale of sales) {
      const product = byId.get(String(sale.product_id));
      if (product) product.sold_qty = Number(sale.sold_qty) || 0;
    }
  } catch (error) {
    console.error('Catalog sales metrics unavailable; products remain available:', error.message);
  }
  return products;
}
