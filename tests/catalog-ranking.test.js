import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/catalog-ranking.js';

const { rankProducts, rankHomeCameras, rankInitialCatalog } = globalThis.UzCamCatalogRanking;
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

test('home camera ranking prioritizes eligible EZVIZ and Hikvision cameras and interleaves brands', () => {
  const cameras = [
    { id: 'ezviz-wifi', cat: 'Kameralar', brand: 'EZVIZ', name: 'C6N WiFi indoor', price: 542000 },
    { id: 'ezviz-edge', cat: 'Kameralar', brand: 'EZVIZ', name: 'C1C kamera', price: 400000 },
    { id: 'hikvision-home', cat: 'Kameralar', brand: 'Hikvision', name: 'WiFi indoor dome', price: 700000, soldQty: 4 },
    { id: 'hikvision-edge', cat: 'Kameralar', brand: 'Hikvision', name: 'IP kamera', price: 800000 },
    { id: 'too-cheap', cat: 'Kameralar', brand: 'EZVIZ', name: 'Uy WiFi kamera', price: 399999 },
    { id: 'too-expensive', cat: 'Kameralar', brand: 'Hikvision', name: 'Uy kamera', price: 800001 },
    { id: 'wrong-brand', cat: 'Kameralar', brand: 'Dahua', name: 'Uy kamera', price: 500000 },
    { id: 'recorder', cat: 'DVR/NVR', brand: 'EZVIZ', name: 'Uy recorder', price: 500000 }
  ];
  const ranked=rankHomeCameras(cameras,{limit:4});
  assert.deepEqual(ranked.map(product=>product.id),['ezviz-wifi','hikvision-home','ezviz-edge','hikvision-edge']);
  assert.ok(ranked.every(product=>product.price>=400000&&product.price<=800000));
});

test('initial catalog prioritizes cameras and NVRs and moves cable and optics after other products', () => {
  const stock=[
    {id:'home',cat:'Kameralar',brand:'EZVIZ',name:'WiFi home camera',price:550000},
    {id:'cam-1',cat:'Kameralar',brand:'Dahua',name:'Camera 1',price:300000},
    {id:'cam-2',cat:'Kameralar',brand:'Dahua',name:'Camera 2',price:300000},
    {id:'cam-3',cat:'Kameralar',brand:'Dahua',name:'Camera 3',price:300000},
    {id:'nvr-1',cat:'DVR/NVR',brand:'Hikvision',name:'NVR 1',price:900000},
    {id:'nvr-2',cat:'DVR/NVR',brand:'Hikvision',name:'NVR 2',price:900000},
    {id:'other',cat:'Aqlli uy',brand:'Other',name:'Smart plug',price:100000},
    {id:'cable',cat:'Kabel va optika',brand:'Other',name:'Optik kabel',price:1000}
  ];
  assert.deepEqual(rankInitialCatalog(stock,{limit:1}).map(product=>product.id),['home','cam-1','cam-2','nvr-1','cam-3','nvr-2','other','cable']);
});
