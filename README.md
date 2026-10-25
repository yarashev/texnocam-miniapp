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
3. **Homepage content (in progress):** admins can update the public promo banner, pick its linked catalog product so price/image stay current, and publish YouTube links and news through authenticated routes. Content currently uses the SQLite settings table; configure durable database storage before relying on it across redeploys.
4. **Catalog and CBU rates:** securely import supplier costs/currencies, fetch official rates from the backend, recalculate UZS prices, and record rate history.
5. **Orders and payments:** create order snapshots, accept payment proof, and let authorized admins confirm payment.
6. **Worker assignment:** expose paid unclaimed orders, atomically claim one, reveal customer contact only to its assigned worker, and record service fees separately.
7. **Telegram bot (in progress):** the service registers its HTTPS webhook at startup using Render’s `RENDER_EXTERNAL_URL`; `/start` and `/help` send a welcome message with a Mini App launch button. The webhook secret is derived from `TELEGRAM_BOT_TOKEN`. Order notifications and admin actions remain future work.

The admin panel is currently a demo UI: its buttons do not persist catalog, order, payment, or staff changes. Telegram identity/session checks protect the panel route, but operational API permissions and durable storage must be finished before processing real admin actions or orders.