import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PAYMENT_PROOF_BYTES, parsePaymentProof } from '../backend/payment-proof.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=', 'base64');

test('payment proofs accept supported image signatures and preserve bytes', () => {
  const parsed = parsePaymentProof({ contentType: 'image/png', base64: png.toString('base64') });
  assert.equal(parsed.contentType, 'image/png');
  assert.deepEqual(parsed.bytes, png);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x01]);
  const webp = Buffer.from('RIFFxxxxWEBP');
  assert.deepEqual(parsePaymentProof({ contentType: 'image/jpeg', base64: jpeg.toString('base64') }).bytes, jpeg);
  assert.deepEqual(parsePaymentProof({ contentType: 'image/webp', base64: webp.toString('base64') }).bytes, webp);
});

test('payment proofs reject unsupported, malformed, mismatched, and oversized files', () => {
  assert.throws(() => parsePaymentProof(null), error => error.statusCode === 400);
  assert.throws(() => parsePaymentProof({ contentType: 'image/svg+xml', base64: 'PHN2Zz4=' }), error => error.statusCode === 400);
  assert.throws(() => parsePaymentProof({ contentType: 'image/png', base64: 'not base64' }), error => error.statusCode === 400);
  assert.throws(() => parsePaymentProof({ contentType: 'image/jpeg', base64: png.toString('base64') }), error => error.statusCode === 400);
  const oversized = 'A'.repeat(Math.ceil(MAX_PAYMENT_PROOF_BYTES / 3) * 4 + 4);
  assert.throws(() => parsePaymentProof({ contentType: 'image/png', base64: oversized }), error => error.statusCode === 413);
});
