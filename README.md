# UzCam Mini App / Backend

This folder is hosting-neutral. It does not require Replit.

## Run locally

Use Node.js 24.15 or newer (the project uses the built-in `node:sqlite` module):

- `npm run dev`
- Open `/api/health` to see whether the database initialized.
- `backend/catalog.json` holds the public sale catalog and seeds SQLite on first startup. `/api/products` returns the database-backed catalog.

The SQLite file is created in `.data/` and is excluded from Git. The checked-in catalog contains sale prices only; supplier costs must stay in a private store. Never commit bot tokens or `.env` files.

## Backend stages

1. **Foundation (current):** SQLite schema, seeded public catalog, health/product read API, role and order tables, and database-level one-worker-per-order claim function.
2. **Telegram identity (in progress):** `/api/session` validates `Telegram.WebApp.initData`, creates/updates the Telegram user record, and issues a short-lived signed admin session. The admin preview route is restricted to active admin/worker roles. Set `TELEGRAM_BOT_TOKEN` and `SUPER_ADMIN_TELEGRAM_ID` as private Render environment variables to enable Super Admin access. Never trust `initDataUnsafe` or a client-supplied Telegram ID.
3. **Catalog and CBU rates:** securely import supplier costs/currencies, fetch official rates from the backend, recalculate UZS prices, and record rate history.
4. **Orders and payments:** create order snapshots, accept payment proof, and let authorized admins confirm payment.
5. **Worker assignment:** expose paid unclaimed orders, atomically claim one, reveal customer contact only to its assigned worker, and record service fees separately.
6. **Admin roles and bot notifications:** enforce Super Admin/Admin/Worker permissions on every API route, send private order notifications, and add audit logs.

The admin panel is currently a demo UI: its buttons do not persist catalog, order, payment, or staff changes. Telegram identity/session checks protect the panel route, but operational API permissions and durable storage must be finished before processing real admin actions or orders.