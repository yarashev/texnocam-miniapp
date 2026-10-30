import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReviewedImageLoader } from '../backend/reviewed-images.js';

const bytes = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const checksum = value => createHash('sha256').update(value).digest('hex');
const row = (id = 1, body = bytes) => ({ id, status: 'replacement-ready', sourceImage: 'https://kss.uz/wp-content/test-' + id + '.png', sha256: checksum(body) });

test('reviewed images coalesce downloads, verify bytes and reuse the cache', async () => {
  let calls = 0;
  const entry = row();
  const loader = createReviewedImageLoader([entry], { download: async () => { calls++; return bytes; } });
  const results = await Promise.all(Array.from({ length: 8 }, () => loader.load(1, entry.sha256.slice(0, 12))));
  assert.equal(calls, 1);
  assert.equal(results[0].contentType, 'image/png');
  assert.deepEqual(results[0].bytes, bytes);
  await loader.load(1, entry.sha256.slice(0, 12));
  assert.equal(calls, 1);
  assert.equal(await loader.load(1, '000000000000'), null);
  assert.equal(await loader.load(999, entry.sha256.slice(0, 12)), null);
});

test('invalid sources, changed bytes and oversized responses never become cached images', async () => {
  for (const url of ['http://kss.uz/image.png', 'https://localhost/image.png', 'https://user:pass@kss.uz/image.png', 'https://kss.uz:444/image.png']) {
    assert.throws(() => createReviewedImageLoader([{ ...row(), sourceImage: url }]));
  }
  let calls = 0;
  const entry = row();
  const loader = createReviewedImageLoader([entry], { download: async () => { calls++; return Buffer.from('changed'); } });
  await assert.rejects(loader.load(1, entry.sha256.slice(0, 12)), /checksum/);
  await assert.rejects(loader.load(1, entry.sha256.slice(0, 12)), /checksum/);
  assert.equal(calls, 2);
  const oversized = createReviewedImageLoader([entry], { maxBytes: 4, download: async () => bytes });
  await assert.rejects(oversized.load(1, entry.sha256.slice(0, 12)));
});

test('image cache and waiting queue remain bounded', async () => {
  const second = Buffer.concat([bytes, Buffer.from('second')]);
  const entries = [row(1), row(2, second)];
  let calls = 0;
  const loader = createReviewedImageLoader(entries, { cacheLimit: second.length, download: async url => { calls++; return url.includes('test-1') ? bytes : second; } });
  await loader.load(1, entries[0].sha256.slice(0, 12));
  await loader.load(2, entries[1].sha256.slice(0, 12));
  await loader.load(1, entries[0].sha256.slice(0, 12));
  assert.equal(calls, 3);
  let finish;
  const bounded = createReviewedImageLoader(entries, { concurrency: 1, maxPending: 0, download: () => new Promise(resolve => { finish = resolve; }) });
  const first = bounded.load(1, entries[0].sha256.slice(0, 12));
  await Promise.resolve();
  await assert.rejects(bounded.load(2, entries[1].sha256.slice(0, 12)), /queue full/);
  finish(bytes);
  await first;
});

test('upstream requests refuse redirects and use a timeout', async () => {
  const original = globalThis.fetch;
  const entry = row();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, entry.sourceImage);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(bytes);
  };
  try {
    const loader = createReviewedImageLoader([entry]);
    assert.deepEqual((await loader.load(1, entry.sha256.slice(0, 12))).bytes, bytes);
  } finally { globalThis.fetch = original; }
});
