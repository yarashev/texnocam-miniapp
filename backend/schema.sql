PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  telegram_id TEXT NOT NULL UNIQUE,
  username TEXT,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer','worker','admin','super_admin')) DEFAULT 'customer',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  model TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',
  source_price REAL CHECK (source_price IS NULL OR source_price >= 0),
  source_currency TEXT CHECK (source_currency IS NULL OR source_currency IN ('UZS','USD','CNY','EUR')),
  rate_used REAL,
  sale_price_uzs INTEGER NOT NULL CHECK (sale_price_uzs >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS products_category_active_idx ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS products_brand_model_idx ON products(brand, model);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY,
  currency TEXT NOT NULL,
  rate_to_uzs REAL NOT NULL CHECK (rate_to_uzs > 0),
  effective_date TEXT NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(currency, effective_date, source)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','paid','assigned','in_service','completed','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','proof_submitted','confirmed','rejected','refunded')),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('address','bts')),
  recipient_name TEXT NOT NULL DEFAULT '',
  delivery_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_fee_uzs INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_uzs >= 0),
  subtotal_uzs INTEGER NOT NULL CHECK (subtotal_uzs >= 0),
  total_uzs INTEGER NOT NULL CHECK (total_uzs >= 0),
  customer_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (delivery_method <> 'bts' OR delivery_fee_uzs = 0)
);
CREATE INDEX IF NOT EXISTS orders_status_payment_idx ON orders(status, payment_status, created_at);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id, created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  model_snapshot TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_uzs INTEGER NOT NULL CHECK (unit_price_uzs >= 0),
  line_total_uzs INTEGER NOT NULL CHECK (line_total_uzs >= 0)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_uzs INTEGER NOT NULL CHECK (amount_uzs >= 0),
  method TEXT NOT NULL CHECK (method IN ('card','qr')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','refunded')),
  proof_path TEXT,
  confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payments_order_status_idx ON payments(order_id, status);

-- UNIQUE(order_id) guarantees that only one worker can claim a paid order.
CREATE TABLE IF NOT EXISTS work_claims (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES users(id),
  service_fee_uzs INTEGER CHECK (service_fee_uzs IS NULL OR service_fee_uzs >= 0),
  service_fee_status TEXT NOT NULL DEFAULT 'not_collected' CHECK (service_fee_status IN ('not_collected','collected')),
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  service_fee_collected_at TEXT
);
CREATE INDEX IF NOT EXISTS work_claims_worker_idx ON work_claims(worker_id, claimed_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at);

INSERT OR IGNORE INTO settings(key, value) VALUES
  ('markup_percent', '30'),
  ('exchange_source', 'CBU'),
  ('exchange_auto_enabled', 'true'),
  ('exchange_last_valid_rate', ''),
  ('exchange_last_valid_date', '');
CREATE TABLE IF NOT EXISTS support_threads (
  customer_telegram_id TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS support_message_links (
  admin_message_id INTEGER PRIMARY KEY,
  customer_telegram_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS support_message_links_customer_idx ON support_message_links(customer_telegram_id, created_at);
