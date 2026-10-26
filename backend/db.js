import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.UZCAM_DATA_DIR ? path.resolve(process.env.UZCAM_DATA_DIR) : path.join(here, '..', '.data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'texnocam.sqlite'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));

function allowUnknownSupplierPrices() {
  const columns = db.prepare('PRAGMA table_info(products)').all();
  if (!columns.some(column => ['source_price', 'source_currency'].some(name => column.name === name && column.notnull))) return;

  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    const migration = [
      'BEGIN IMMEDIATE;',
      'CREATE TABLE products_migrated (',
      '  id INTEGER PRIMARY KEY,',
      '  model TEXT NOT NULL UNIQUE,',
      '  name TEXT NOT NULL,',
      '  brand TEXT NOT NULL,',
      '  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,',
      "  description TEXT NOT NULL DEFAULT '',",
      "  image_path TEXT NOT NULL DEFAULT '',",
      '  source_price REAL CHECK (source_price IS NULL OR source_price >= 0),',
      "  source_currency TEXT CHECK (source_currency IS NULL OR source_currency IN ('UZS','USD','CNY','EUR')),",
      '  rate_used REAL,',
      '  sale_price_uzs INTEGER NOT NULL CHECK (sale_price_uzs >= 0),',
      '  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),',
      '  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,',
      '  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,',
      '  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
      ');',
      'INSERT INTO products_migrated SELECT * FROM products;',
      'DROP TABLE products;',
      'ALTER TABLE products_migrated RENAME TO products;',
      'CREATE INDEX products_category_active_idx ON products(category_id, is_active);',
      'CREATE INDEX products_brand_model_idx ON products(brand, model);',
      'COMMIT;'
    ].join('\n');
    db.exec(migration);
  } catch (error) {
    try { db.exec('ROLLBACK;'); } catch {}
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

function seedCatalog() {
  if (db.prepare('SELECT 1 FROM products LIMIT 1').get()) return;
  const catalog = JSON.parse(fs.readFileSync(path.join(here, 'catalog.json'), 'utf8'));
  db.exec('BEGIN IMMEDIATE;');
  try {
    const insertCategory = db.prepare('INSERT OR IGNORE INTO categories(name) VALUES (?)');
    const categoryId = db.prepare('SELECT id FROM categories WHERE name = ?');
    const insertProduct = db.prepare([
      'INSERT OR IGNORE INTO products',
      '  (id, model, name, brand, category_id, description, image_path, source_price,',
      '   source_currency, rate_used, sale_price_uzs, is_active)',
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
    ].join('\n'));
    for (const product of catalog.products) insertCategory.run(product.category);
    for (const product of catalog.products) {
      insertProduct.run(
        product.id, product.model, product.name, product.brand,
        categoryId.get(product.category).id, product.description, product.image,
        product.source_price, product.source_currency, product.rate_used, product.sale_price_uzs
      );
    }
    db.prepare('INSERT OR IGNORE INTO exchange_rates(currency, rate_to_uzs, effective_date, source) VALUES (?, ?, ?, ?)')
      .run(catalog.exchange_rate.currency, catalog.exchange_rate.rate_to_uzs, catalog.exchange_rate.effective_date, catalog.exchange_rate.source);
    db.prepare("UPDATE settings SET value = ? WHERE key = 'markup_percent'").run(String(catalog.markup_percent));
    db.exec('COMMIT;');
  } catch (error) {
    try { db.exec('ROLLBACK;'); } catch {}
    throw error;
  }
}

allowUnknownSupplierPrices();
if (!db.prepare('PRAGMA table_info(products)').all().some(column => column.name === 'deleted_at')) db.exec('ALTER TABLE products ADD COLUMN deleted_at TEXT');
seedCatalog();

export function listPublicProducts() {
  return db.prepare(`
    SELECT p.id, p.model, p.name, p.brand, c.name AS category,
           p.description, p.image_path AS image, p.sale_price_uzs AS price_uzs
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND p.deleted_at IS NULL
    ORDER BY p.brand, p.model
  `).all();
}

// Claiming is serialized at the database level; the unique order_id is the final race guard.
export function claimPaidOrder(orderId, workerUserId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const worker = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'worker' AND is_active = 1").get(workerUserId);
    if (!worker) throw Object.assign(new Error('Active worker account required'), { statusCode: 403 });
    const order = db.prepare("SELECT id FROM orders WHERE id = ? AND payment_status = 'confirmed'").get(orderId);
    if (!order) throw Object.assign(new Error('Only confirmed paid orders can be claimed'), { statusCode: 409 });
    db.prepare('INSERT INTO work_claims(order_id, worker_id) VALUES (?, ?)').run(orderId, workerUserId);
    db.prepare("UPDATE orders SET status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);
    db.exec('COMMIT');
    return db.prepare('SELECT order_id, worker_id, claimed_at FROM work_claims WHERE order_id = ?').get(orderId);
  } catch (error) {
    db.exec('ROLLBACK');
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed: work_claims\.order_id/i.test(error.message)) {
      throw Object.assign(new Error('This order has already been claimed'), { statusCode: 409 });
    }
    throw error;
  }
}

export function recordServiceFee(orderId, workerUserId, amountUzs) {
  if (!Number.isSafeInteger(amountUzs) || amountUzs < 0) {
    throw Object.assign(new Error('Service fee must be a non-negative whole number'), { statusCode: 400 });
  }
  const result = db.prepare(`
    UPDATE work_claims
    SET service_fee_uzs = ?, service_fee_status = 'collected', service_fee_collected_at = CURRENT_TIMESTAMP
    WHERE order_id = ? AND worker_id = ?
  `).run(amountUzs, orderId, workerUserId);
  if (result.changes !== 1) throw Object.assign(new Error('Claim not found for this worker'), { statusCode: 404 });
  return db.prepare('SELECT order_id, worker_id, service_fee_uzs, service_fee_status, service_fee_collected_at FROM work_claims WHERE order_id = ?').get(orderId);
}