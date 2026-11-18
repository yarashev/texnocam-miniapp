# Checkout price and retry protection

The delivery form opens `/api/checkout` before showing payment details. This creates one unpaid order with database product names, quantities and price snapshots. It returns the stored total; the client displays that amount before enabling payment submission. Catalog changes after this point do not reprice the order.

`/api/orders` submits that same prepared order for payment review. `orders.payment_status` becomes `proof_submitted`; the actual payment record remains `pending` until an admin checks it. Preparing an order does not send order notifications. Customer/admin notifications are queued once when submission succeeds. Unsubmitted orders remain visible as unpaid orders; creation does not mean payment has occurred.

New clients persist an opaque UUID and a hashed checkout fingerprint before sending a request. Retries use the same UUID, including after a lost response or restart. The server binds it to the authenticated Telegram user and normalized cart/delivery data, serializes concurrent requests, and writes the order and request mapping in the same transaction. Reusing the key with different details fails with 409. Client prices are never accepted as authoritative.

Compatibility: older clients without a UUID use a server-side ten-minute deduplication window for identical cart/delivery data. They are accepted only when their displayed total matches current database prices; a mismatch asks the customer to reopen the mini app or contact admin if already paid. New clients always prepare the price before payment.

Production migration only adds `checkout_requests`; PostgreSQL RLS is enabled. Existing orders and payments are preserved. Operational admin order notices use the durable notification queue and are not suppressed by marketing notification preferences. This does not confirm payments automatically or send worker offers before admin approval.

Validation covers simultaneous retries, changed catalog prices, forged client prices, changed cart/user, invalid requests, rollback/retry, restart persistence, old-client compatibility, and the browser → API → SQLite → confirmation flow. PostgreSQL SQL behavior is tested with PGlite. Local Telegram calls are mocked; no real payments or customer notifications are created by these tests.
