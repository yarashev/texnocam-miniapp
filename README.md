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
2. **Telegram identity:** validate `Telegram.WebApp.initData` on the server; create/update customer records. Never trust `initDataUnsafe` or a client-supplied Telegram ID.
3. **Catalog and CBU rates:** securely import supplier costs/currencies, fetch official rates from the backend, recalculate UZS prices, and record rate history.
4. **Orders and payments:** create order snapshots, accept payment proof, and let authorized admins confirm payment.
5. **Worker assignment:** expose paid unclaimed orders, atomically claim one, reveal customer contact only to its assigned worker, and record service fees separately.
6. **Admin roles and bot notifications:** enforce Super Admin/Admin/Worker permissions on every API route, send private order notifications, and add audit logs.

Stage 1 has no write endpoints or authentication. The deployed service is a public read-only test backend; do not use it for customer/admin data or real orders until authentication and durable storage are in place.