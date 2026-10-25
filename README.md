# TexnoCam Mini App / Backend

This folder is hosting-neutral. It does not require Replit.

## Run locally

Use Node.js 24.15 or newer (the project uses the built-in `node:sqlite` module):

- `npm run dev`
- Open `/api/health` to see whether the database initialized.
- `/api/products` returns the public catalog stored in SQLite (empty until products are imported).

The SQLite file is created in `.data/` and is excluded from Git. Never commit bot tokens or `.env` files.

## Backend stages

1. **Foundation (current):** SQLite schema, role and order tables, public read-only API, and database-level one-worker-per-order claim function.
2. **Telegram identity:** validate `Telegram.WebApp.initData` on the server; create/update customer records. Never trust `initDataUnsafe` or a client-supplied Telegram ID.
3. **Catalog and CBU rates:** import source costs/currencies, fetch official rates from the backend, recalculate UZS prices, and record rate history.
4. **Orders and payments:** create order snapshots, accept payment proof, and let authorized admins confirm payment.
5. **Worker assignment:** expose paid unclaimed orders, atomically claim one, reveal customer contact only to its assigned worker, and record service fees separately.
6. **Admin roles and bot notifications:** enforce Super Admin/Admin/Worker permissions on every API route, send private order notifications, and add audit logs.

Stage 1 intentionally has no write endpoints or authentication yet. Do not expose an unfinished backend publicly.