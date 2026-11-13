import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getProductSpecification, normalizeProductModel } from '../backend/product-specifications.js';

const specificationRecords = JSON.parse(readFileSync(new URL('../backend/product-specifications.json', import.meta.url), 'utf8'));

test('model normalization preserves decimal separators', () => {
  assert.notEqual(normalizeProductModel('HDMI 4K 1,5m'), normalizeProductModel('HDMI 4K 15m'));
  assert.equal(normalizeProductModel('CS-H8c (3MP)'), normalizeProductModel('CS H8C [3mp]'));
});

test('specification data contains technical fields only, never supplier prices', () => {
  assert.ok(specificationRecords.length > 0);
  for (const record of specificationRecords) {
    assert.deepEqual(Object.keys(record).sort(), ['model', 'specification']);
    assert.doesNotMatch(record.specification, /\$\s*\d|\b\d+(?:[.,]\d+)?\s*(?:USD|UZS|RUB|EUR|\u0441\u0443\u043c)\b/i);
  }
});

test('specifications match exact models and complete model tokens in product names', () => {
  const camera = getProductSpecification('CS-H8c (3MP)');
  assert.ok(camera);
  assert.doesNotMatch(camera, /\bPOE\b/i);
  assert.equal(getProductSpecification('', 'Tapo C110 (3MP WIFI)'), getProductSpecification('Tapo C110'));

  const adapter = getProductSpecification('', 'SC-LC CABLE 10M');
  assert.ok(adapter.includes('SC-LC'));
  assert.notEqual(adapter, getProductSpecification('LC-LC'));
  assert.match(getProductSpecification('DS-TMG040'), /даташит не опубликован/i);
  assert.equal(getProductSpecification('UNKNOWN-123', 'Unknown product'), '');
});
