import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/catalog-ranking.js';

const { rankProducts } = globalThis.UzCamCatalogRanking;
const products = [
  { id: 1, name: 'IP kamera', brand: 'Acme', spec: '1080P', price: 300, views: 1 },
  { id: 2, name: 'IP kamera Pro', brand: 'Acme', spec: '4K', price: 100 },
  { id: 3, name: 'WiFi kamera', brand: 'Other', spec: '2K', price: 200, soldQty: 10 },
  { id: 4, name: 'DVR', brand: 'Acme', spec: '8 kanal', price: 400 }
];

test('search ranking prioritizes exact product-name matches', () => {
  const matching = products.filter(product => product.name.toLowerCase().includes('ip kamera'));
  const ranked = rankProducts(matching, { tokens: ['ip kamera'], priceTier: 'all' });
  assert.equal(ranked[0].id, 1);
});

test('empty search ranks products with confirmed sales higher', () => {
  const ranked = rankProducts(products, { tokens: [], priceTier: 'all' });
  assert.equal(ranked[0].id, 3);
});

test('price tiers filter by price band before applying ranking', () => {
  assert.deepEqual(rankProducts(products, { priceTier: 'cheap' }).map(p => p.id).sort(), [2, 3]);
  assert.deepEqual(rankProducts(products, { priceTier: 'medium' }).map(p => p.id), [1]);
  assert.deepEqual(rankProducts(products, { priceTier: 'expensive' }).map(p => p.id), [4]);
});
