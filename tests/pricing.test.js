import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSalePrice, normalizeMarkupPercent } from '../backend/pricing.js';
test('accepts default markup', () => assert.equal(normalizeMarkupPercent('30'), 30));
test('calculates sale price using configured markup', () => {
 assert.equal(calculateSalePrice(100, 15000, 30), 1950000);
 assert.equal(calculateSalePrice(100, 15000, 0), 1500000);
 assert.equal(calculateSalePrice(100, 15000, 12.5), 1687500);
});
test('limits markup to 0–300 percent', () => {
 assert.equal(normalizeMarkupPercent(0), 0); assert.equal(normalizeMarkupPercent(300), 300);
 assert.throws(() => normalizeMarkupPercent(-1), /0–300/);
 assert.throws(() => normalizeMarkupPercent(301), /0–300/);
 assert.throws(() => normalizeMarkupPercent('abc'), /0–300/);
});
test('rejects invalid cost and exchange rate', () => {
 assert.throws(() => calculateSalePrice(0, 15000, 30), /Manba narxi/);
 assert.throws(() => calculateSalePrice(100, 0, 30), /Manba narxi/);
});
