# Reliable Telegram delivery

Order notifications and technician offers/details/button changes are persisted in `customer_notifications`. Payment confirmation and offer enqueueing share a transaction; technician acceptance/cancellation also commits its delivery work atomically. A 10-minute finalization marker, assignment state and customer notification commit together. Customer contact details are resolved only for the currently assigned technician.

Delivery uses a unique lease per attempt, a 120-second lease window, bounded Telegram requests (10 seconds), retry backoff and Telegram `retry_after`. Expired leases are recovered while live leases are preserved across deploys. Old attempts cannot acknowledge or reset a new owner's lease. Telegram edits already applied or messages already removed are handled separately from malformed requests. Superseded offers/details are not delivered. Success/failure state is persisted.

Telegram does not provide an idempotency key for `sendMessage`: a provider acceptance followed by a network/process failure can still produce a duplicate on retry. Delivery is therefore at least once, not an exactly-once promise. Service actions remain authorized and idempotent independently of message delivery.

The notification runner cannot overlap itself; wakeups request another pass after the current pass. FX checks run independently so they do not block delivery. SIGTERM stops accepting background work, drains the active operation, waits for HTTP shutdown, and closes the database. A hard crash is recovered using leases on the next running instance.

Super Admin: **Hisobotlar va sozlamalar → Xabarlar yuborilishi** shows queued, in-flight, successful, failed and superseded work. Failed records can be explicitly retried; retry attempts are audited. Superseded operations cannot be retried. Existing marketing notification preferences remain enforced, with the prior operational support/order-admin exceptions.

## Hosting decision awaiting owner approval

Current service: `texnocam-miniapp`, Frankfurt, one Free web instance. Free instances sleep when idle. Code changes cannot provide continuous polling while the process is stopped.

Recommended change: upgrade that existing web instance to **0.5 CPU / 512 MB (`0.5c-512mb`)**. Render's official pricing page lists **$7/month** base compute for this size (checked 2026-11-19). Existing database, application URL and one-instance count stay the same. No new worker or Redis service is needed for the current traffic. Other usage charges, if any, follow the account's existing Render billing rules. The instance change has not been made; it requires approval of the new recurring expense. Dashboard: https://dashboard.render.com/web/srv-dbf4h47b9u1s73bjltqg

This removes idle sleep, not all possible outages. Telegram/hosting/database incidents can delay delivery; durable retries resume after recovery. Live Telegram tests still require a dedicated test order and technician account. All automated Telegram calls are mocked.
