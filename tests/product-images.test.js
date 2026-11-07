import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../assets/product-images.js', import.meta.url), 'utf8'), context);
const { resolve } = context.window.UzCamProductImages;
const sources = JSON.parse(fs.readFileSync(new URL('../assets/official-products/sources.json', import.meta.url), 'utf8'));

function reviewedContext() {
  let errorHandler;
  const context = { window: {}, document: { addEventListener(name, handler, capture) {
    if (name === 'error' && capture) errorHandler = handler;
  } } };
  vm.runInNewContext(fs.readFileSync(new URL('../assets/reviewed-product-images.js', import.meta.url), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(new URL('../assets/product-images.js', import.meta.url), 'utf8'), context);
  return { context, errorHandler, resolve: context.window.UzCamProductImages.resolve };
}

test('every compiled replacement preserves custom images and uses an approved source', () => {
  const { context, resolve } = reviewedContext();
  const report = JSON.parse(fs.readFileSync(new URL('../assets/product-image-audit.json', import.meta.url), 'utf8'));
  assert.equal(report.products.length, report.catalogCount);
  assert.equal(new Set(report.products.map(row => row.id)).size, report.catalogCount);
  assert.equal(context.window.UzCamReviewedPhotos.length, report.summary['replacement-ready']);
  for (const [brand, model, previous, selected] of context.window.UzCamReviewedPhotos) {
    assert.equal(resolve(brand, model, previous), selected);
    assert.equal(resolve(brand, model, '/uploads/private-choice.webp'), '/uploads/private-choice.webp');
    assert.match(selected, /^\/api\/reviewed-product-images\/\d+\/[a-f0-9]{12}$/);
  }
  for (const id of [77, 884, 885]) {
    assert.equal(report.products.find(row => row.id === id).status, 'needs-model-photo-review');
  }
});

test('Cyrillic names do not collide and pack variants do not cross-match', () => {
  const context = { window: { UzCamReviewedPhotos: [
    ['Бренд', 'Кабель 2', 'assets/cable.webp', 'https://kss.uz/cable.jpg'],
    ['Бренд', 'Датчик 2', 'assets/sensor.webp', 'https://kss.uz/sensor.jpg']
  ] } };
  vm.runInNewContext(fs.readFileSync(new URL('../assets/product-images.js', import.meta.url), 'utf8'), context);
  const { resolve } = context.window.UzCamProductImages;
  assert.equal(resolve('Бренд', 'Кабель 2', 'assets/cable.webp'), 'https://kss.uz/cable.jpg');
  assert.equal(resolve('Бренд', 'Датчик 2', 'assets/sensor.webp'), 'https://kss.uz/sensor.jpg');
  assert.equal(resolve('Бренд', 'Кабель 2 (2-pack)', 'assets/cable.webp'), 'assets/cable.webp');
});

test('source failures fall back once to the original image without hiding it', () => {
  const { context, errorHandler } = reviewedContext();
  const [brand, model, previous, selected] = context.window.UzCamReviewedPhotos.find(row => row[2]);
  const image = { tagName: 'IMG', alt: model, dataset: {}, hidden: false, src: selected, getAttribute() { return this.src; } };
  let stopped = false;
  errorHandler({ target: image, stopImmediatePropagation() { stopped = true; } });
  assert.equal(image.src, previous);
  assert.equal(image.hidden, false);
  assert.equal(stopped, true);
  stopped = false;
  errorHandler({ target: image, stopImmediatePropagation() { stopped = true; } });
  assert.equal(stopped, false);
  const unrelated = { tagName: 'IMG', alt: brand, dataset: {}, src: '/uploads/chosen.png', getAttribute() { return this.src; } };
  errorHandler({ target: unrelated, stopImmediatePropagation() { assert.fail('Custom image must be untouched'); } });
  assert.equal(unrelated.src, '/uploads/chosen.png');
});

test('official photos match exact model variants and preserve custom admin images', () => {
  for (const photo of sources.products) {
    assert.equal(resolve(photo.brand, photo.model, photo.previousImage), photo.image);
    assert.equal(resolve(photo.brand.toLowerCase(), photo.model.toLowerCase(), photo.previousImage), photo.image);
    assert.equal(resolve(photo.brand, photo.model, '/uploads/admin-choice.png'), '/uploads/admin-choice.png');
    assert.equal(resolve('Other brand', photo.model, photo.previousImage), photo.previousImage);
  }
  assert.equal(resolve('EZVIZ', 'CS-H6c G1 5MP', 'assets/ezviz/04.webp'), 'assets/ezviz/04.webp');
  assert.equal(resolve('EZVIZ', 'CS-H6C pro (5MP)', 'assets/ezviz/03.webp'), 'assets/ezviz/03.webp');
});

test('direct product photos match exact unresolved models and preserve custom images', () => {
  const photos = [
  [
    "EZVIZ",
    "CS-H8c G1 (8MP)",
    "https://bestways.com/cdn/shop/files/2MP_HD_Video_P_45.png?v=1763914587"
  ],
  [
    "EZVIZ",
    "CS-HB8C/SP (4MP)",
    "https://viethansecurity.com/media/product/12054_camera_pin_nang_luong_mat_troi_ezviz_cs_hb8c_sp_2k_4mp.jpg"
  ],
  [
    "EZVIZ",
    "CS-HB8C/SP (6MP)",
    "https://newworld.co.za/cdn/shop/files/M2bieHd6L3AhbmSPpDA4NsAPmeU.jpg?v=1774087764"
  ],
  [
    "EZVIZ",
    "CS-DL50FVS (WBP,GR)",
    "https://lcdn.altex.ro/media/catalog/product/d/l/dl50fvs_13_78b87212.jpg"
  ],
  [
    "Turli brendlar",
    "DS-UPS3000-R(O-STD)/EU/Uni(E)",
    "https://assets.hikvision.com/prd/normal/all/image/m000177858/UCBL400_SQ162-2-%E6%95%88%E6%9E%9C%E5%9B%BE003-%E5%8F%B3%E5%89%8D%E4%BE%A7.png"
  ],
  [
    "Mercusys",
    "Mercusys Halo H60X(2-pack AX1500 WIFI 6)",
    "https://static.mercusys.com/product-image/01_large20250417012824.jpg"
  ],
  [
    "Turli brendlar",
    "DS-K3B801BX-L/MPg(O-STD)",
    "https://alti-group.ru/upload/iblock/aa8/xbxpzvxkmxr50de82wlt8oio9j8a0ezx.png"
  ],
  [
    "Turli brendlar",
    "DS-K3B801BX-M/MPg(O-STD)",
    "https://alti-group.ru/upload/iblock/aa8/xbxpzvxkmxr50de82wlt8oio9j8a0ezx.png"
  ],
  [
    "Turli brendlar",
    "DS-K3B801BX-R/MPg(O-STD)",
    "https://alti-group.ru/upload/iblock/aa8/xbxpzvxkmxr50de82wlt8oio9j8a0ezx.png"
  ],
  [
    "ZKTeco",
    "ZKTeco CMP200 Remote Control Трехкнопочный беспроводной пульт",
    "https://www.cyberpuerta.mx/img/product/XL/CP-ZKTECO-CMP200REMOTECONTROL-ef54ad.jpg"
  ]
];
  const allowedHosts = new Set(photos.map(([, , url]) => new URL(url).hostname));
  for (const [brand, model, url] of photos) {
    assert.equal(resolve(brand, model, ''), url);
    assert.equal(resolve(brand, model, '/uploads/admin-choice.png'), '/uploads/admin-choice.png');
    assert.equal(resolve(brand, model + ' (different model)', ''), '');
    assert.equal(new URL(url).protocol, 'https:');
    assert.ok(allowedHosts.has(new URL(url).hostname));
  }
});

test('bundled official PNGs exist at their documented native dimensions', () => {
  for (const photo of sources.products) {
    const bytes = fs.readFileSync(new URL('../' + photo.image, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), photo.width);
    assert.equal(bytes.readUInt32BE(20), photo.height);
    assert.ok(bytes.length < 250000);
    assert.equal(new URL(photo.sourceImage).hostname, 'mfs.ezvizlife.com');
    assert.equal(new URL(photo.sourcePage).hostname, 'www.ezviz.com');
  }
});
