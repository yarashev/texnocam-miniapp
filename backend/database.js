import { mergeCatalogCategories, listCatalogCategories } from './category-management.js';
import { postgresTls } from './postgres-tls.js';
import { createPostgresDatabase, createSqliteDatabase } from './database-adapters.js';
import { initializePostgres } from './postgres-initialize.js';

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
export const listPublicCategories=()=>listCatalogCategories(db);

export async function listPublicProducts() {
  return db.all(`SELECT p.id, p.model, p.name, p.brand, c.name AS category,
    p.description, p.image_path AS image, p.sale_price_uzs AS price_uzs,
    (SELECT COUNT(*) FROM audit_log a WHERE a.entity_type = 'analytics' AND a.action = 'product_view' AND a.entity_id = CAST(p.id AS TEXT)) AS views,
    (SELECT COUNT(*) FROM audit_log a WHERE a.entity_type = 'analytics' AND a.action = 'add_to_cart' AND a.entity_id = CAST(p.id AS TEXT)) AS cart_adds,
    (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.payment_status = 'confirmed') AS sold_qty
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND p.deleted_at IS NULL ORDER BY p.brand, p.model`);
}
