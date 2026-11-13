import fs from 'node:fs';

const logPath = process.env.UZCAM_TEST_TELEGRAM_LOG;
if (!logPath) throw new Error('UZCAM_TEST_TELEGRAM_LOG is required for the Telegram mock');

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.hostname !== 'api.telegram.org') return originalFetch(input, init);
  const payload = JSON.parse(init?.body || '{}');
  const method = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  fs.appendFileSync(logPath, JSON.stringify({ method, payload }) + '\n');
  return new Response(JSON.stringify({ ok: true, result: { message_id: 1234 } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
