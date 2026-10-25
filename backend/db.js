import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', '.data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'texnocam.sqlite'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));

export function listPublicProducts() {
  return db.prepare(`
    SELECT p.id, p.model, p.name, p.brand, c.name AS category,
           p.description, p.image_path AS image, p.sale_price_uzs AS price_uzs
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1
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