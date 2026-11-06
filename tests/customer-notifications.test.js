import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchCustomerNotifications, enqueueCustomerNotification } from '../backend/customer-notifications.js';

test('enqueue creates an idempotent customer notification record', async () => {
  let captured;
  const database = { run: async (sql, ...params) => { captured = { sql, params }; return { changes: 1 }; } };
  await enqueueCustomerNotification(database, { userId: 7, orderId: 12, eventKey: 'order:12:created', title: 'Buyurtma', message: 'Qabul qilindi' });
  assert.match(captured.sql, /ON CONFLICT\(event_key\) DO NOTHING/);
  assert.deepEqual(captured.params.slice(0, 5), [7, 12, 'order:12:created', 'Buyurtma', 'Qabul qilindi']);
  assert.equal(typeof captured.params[5], 'string');
  assert.equal(captured.params[5].length, 19);
});

test('dispatcher sends opted-in notifications and records successful delivery', async () => {
  const updates = [];
  const database = {
    all: async () => [{ id: 4, user_id: 7, telegram_id: '1234567', message: 'Buyurtma qabul qilindi' }],
    run: async (sql, ...params) => { updates.push({ sql, params }); return { changes: 1 }; }
  };
  const sent = [];
  const result = await dispatchCustomerNotifications(database, async (method, payload) => { sent.push({ method, payload }); });
  assert.equal(result.processed, 1);
  assert.equal(result.sent, 1);
  assert.deepEqual(sent, [{ method: 'sendMessage', payload: { chat_id: '1234567', text: 'Buyurtma qabul qilindi' } }]);
  assert.match(updates[0].sql, /delivery_status = 'sending'/);
  assert.match(updates[1].sql, /delivery_status = 'sent'/);
});

test('dispatcher schedules retry when Telegram send fails', async () => {
  const updates = [];
  const database = {
    all: async () => [{ id: 5, user_id: 8, telegram_id: '7654321', message: 'To‘lov tasdiqlandi' }],
    run: async (sql, ...params) => { updates.push({ sql, params }); return { changes: 1 }; },
    get: async () => ({ attempts: 2 })
  };
  const result = await dispatchCustomerNotifications(database, async () => { throw new Error('Telegram API sendMessage failed'); });
  assert.equal(result.processed, 1);
  assert.equal(result.sent, 0);
  assert.match(updates[1].sql, /next_attempt_at = \?/);
  assert.equal(updates[1].params[0], 'pending');
  assert.match(updates[1].params[1], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});


test('dispatcher does not send the same notification twice when another worker already claimed it', async () => {
  let claimCount = 0;
  const database = {
    all: async () => [{ id: 9, user_id: 3, telegram_id: '1234567', message: 'Buyurtma' }],
    run: async (sql) => {
      if (sql.includes("delivery_status = 'sending'")) {
        claimCount++;
        return { changes: claimCount === 1 ? 1 : 0 };
      }
      return { changes: 1 };
    }
  };
  let sends = 0;
  await Promise.all([
    dispatchCustomerNotifications(database, async () => { sends++; }),
    dispatchCustomerNotifications(database, async () => { sends++; })
  ]);
  assert.equal(claimCount, 2);
  assert.equal(sends, 1);
});

test('dispatcher stops retrying after the eighth failed attempt', async () => {
  const updates = [];
  const database = {
    all: async () => [{ id: 10, user_id: 4, telegram_id: '1234567', message: 'Buyurtma' }],
    run: async (sql, ...params) => { updates.push({ sql, params }); return { changes: 1 }; },
    get: async () => ({ attempts: 8 })
  };
  await dispatchCustomerNotifications(database, async () => { throw new Error('Telegram unavailable'); });
  assert.match(updates[1].sql, /delivery_status = \?/);
  assert.equal(updates[1].params[0], 'failed');
  assert.equal(updates[1].params[2], 'Telegram unavailable');
});

test('queue query only selects active customers who explicitly started the bot', async () => {
  let query = '';
  const database = { all: async (sql) => { query = sql; return []; } };
  await dispatchCustomerNotifications(database, async () => {});
  assert.match(query, /JOIN telegram_notification_preferences p/);
  assert.match(query, /p\.enabled = 1/);
  assert.match(query, /u\.is_active = 1/);
});

test('enqueue ignores incomplete event payloads without writing to the database', async () => {
  let writes = 0;
  const database = { run: async () => { writes++; } };
  await enqueueCustomerNotification(database, { userId: 1, eventKey: 'missing-message' });
  await enqueueCustomerNotification(database, { eventKey: 'missing-user', message: 'Hello' });
  assert.equal(writes, 0);
});
