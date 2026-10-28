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

const stock=[
 {id:'model',model:'DS-2CD2043G2-I',name:'IP kamera',brand:'Hikvision',spec:'4MP 2.8mm',price:500},
 {id:'similar',model:'DS-2CD2047G2-I',name:'IP kamera Pro',brand:'Hikvision',price:400,soldQty:1e20},
 {id:'ezviz',model:'CS-H6C',name:'WiFi kamera',brand:'EZVIZ',spec:'5MP',price:300}
];
test('model punctuation, case, digits and spacing',()=>{
 for(const query of ['ds2cd2043g2i','DS 2CD2043G2 I','2043','HIKVISION 2043','2043 kamera'])assert.equal(rankProducts(stock,{query})[0]?.id,'model',query);
});
test('wrong numeric codes do not fuzzy match',()=>{assert.equal(rankProducts(stock,{query:'2049'}).length,0);});
test('Cyrillic, synonyms, typos and word order',()=>{
 for(const query of ['камера hikvision','hikvision kamerа','camera 2043','kamrea 2043','2043 kamera'])assert.ok(rankProducts(stock,{query}).some(p=>p.id==='model'),query);
});
test('exact matches outrank popular partial matches',()=>{
 assert.equal(rankProducts([{id:1,name:'IP kamera',price:100},{id:2,name:'IP kamera Pro',price:50,soldQty:1e100}],{query:'IP kamera'})[0].id,1);
});
test('all terms must match and empty queries preserve browsing',()=>{
 assert.equal(rankProducts(stock,{query:'2043 ezviz'}).length,0);
 assert.equal(rankProducts(stock,{query:'  '}).length,3);
});
test('index refreshes after model changes',()=>{
 const item={id:1,model:'ABC123',name:'Camera',price:1};
 assert.equal(rankProducts([item],{query:'ABC123'}).length,1);item.model='XYZ987';
 assert.equal(rankProducts([item],{query:'ABC123'}).length,0);
 assert.equal(rankProducts([item],{query:'XYZ987'}).length,1);
});
