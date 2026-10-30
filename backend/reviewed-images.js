import { createHash } from 'node:crypto';

const hosts = new Set(['kss.uz', 'mfs.ezvizlife.com', 'static.tp-link.com']);
const failure = (message, statusCode = 502) => Object.assign(new Error(message), { statusCode });
const contentType = bytes => {
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())) return 'image/gif';
  throw failure('Invalid reviewed image');
};

export function createReviewedImageLoader(records, options = {}) {
  const maxBytes = options.maxBytes ?? 4_000_000;
  const cacheLimit = options.cacheLimit ?? 32 * 1024 * 1024;
  const concurrency = options.concurrency ?? 12;
  const maxPending = options.maxPending ?? 96;
  const entries = new Map();
  for (const row of records) {
    if (row.status !== 'replacement-ready') continue;
    const url = new URL(row.sourceImage);
    if (url.protocol !== 'https:' || !hosts.has(url.hostname) || url.username || url.password || (url.port && url.port !== '443') || !/^[a-f0-9]{64}$/.test(row.sha256)) throw failure('Invalid reviewed source', 500);
    entries.set(String(row.id), row);
  }
  const cache = new Map(), pending = new Map(), waiters = [];
  let active = 0, cachedBytes = 0;
  const acquire = async () => {
    if (active < concurrency) { active++; return; }
    if (waiters.length >= maxPending) throw failure('Image queue full', 503);
    await new Promise(resolve => waiters.push(resolve));
  };
  const release = () => { if (waiters.length) waiters.shift()(); else active--; };
  const download = options.download || (async url => {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'image/*' } });
    if (!response.ok || !response.body) throw failure('Reviewed source unavailable');
    const reader = response.body.getReader(), chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) throw failure('Reviewed image too large');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel().catch(() => {}); }
    return Buffer.concat(chunks);
  });
  return {
    async load(id, version) {
      const row = entries.get(String(id));
      if (!row || version !== row.sha256.slice(0, 12)) return null;
      const key = row.sha256;
      if (cache.has(key)) {
        const image = cache.get(key); cache.delete(key); cache.set(key, image); return image;
      }
      if (pending.has(key)) return pending.get(key);
      const task = (async () => {
        await acquire();
        try {
          const bytes = Buffer.from(await download(row.sourceImage));
          if (bytes.length > maxBytes || createHash('sha256').update(bytes).digest('hex') !== key) throw failure('Reviewed image checksum mismatch');
          const image = { bytes, contentType: contentType(bytes), etag: '"' + key + '"' };
          if (bytes.length <= cacheLimit) {
            while (cachedBytes + bytes.length > cacheLimit && cache.size) {
              const oldest = cache.keys().next().value; cachedBytes -= cache.get(oldest).bytes.length; cache.delete(oldest);
            }
            cache.set(key, image); cachedBytes += bytes.length;
          }
          return image;
        } finally { release(); }
      })();
      pending.set(key, task);
      try { return await task; } finally { pending.delete(key); }
    }
  };
}
