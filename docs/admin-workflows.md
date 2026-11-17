# Admin workflows — 2026-11-17

Super Admin opens **Adminlar → Ruxsatlar** on an individual admin row. The server checks the saved permissions on every protected request. Existing admins retain their prior permissions until configured. Head workers continue to manage only technicians and service rates; they cannot access sales, payments, customers or general settings.

**Usta ishlari va murojaatlar:** contact the customer and technician, describe the resolution, then send the job back for customer review. This resets the provisional star selection and sends a fresh review notification. Only the customer can select 1–5 stars and confirm completion. Repeated disputes are supported; submitting the same resolution twice is rejected.

**Buyurtmalar → Hisobot yuklab olish:** CSV uses the selected payment status, delivery method, search and UTC date range. It includes matching orders beyond the 100 visible rows, up to 10,000. Narrow the date range for larger exports. Spreadsheet formula injection is neutralized.

**Hisobotlar va sozlamalar → CBU:** USD, EUR and CNY are fetched from the official CBU JSON endpoint and normalized by Nominal. Automatic checks run hourly while the application is running. Free hosting may sleep when idle. Last good rates survive failed requests. Automatic checks start enabled; price application and Super Admin notifications start disabled. Enable and save them when desired. Repricing only affects non-deleted products with positive foreign source costs; it uses the configured markup. Fixed UZS prices and products without source costs are preserved.

**To‘lov rekvizitlari:** save a 16-digit card number, cardholder and/or a PNG/JPG/WEBP QR image up to 3 MB. The database keeps the active QR image and replaces its previous bytes. Checkout fetches the active settings before enabling submission; failed loads offer retry. Existing default QR remains until changed. No real card details are seeded by this release.

Validation: SQLite and PostgreSQL integration tests, server restart persistence, API permission rejection, CSV escaping, FX outage behavior, customer-only completion, QR replacement, mobile browser checks and official CBU fetch. Telegram delivery is mocked in automated tests. Live Telegram end-to-end testing requires a dedicated order and test technician account; it has not been represented as complete.
