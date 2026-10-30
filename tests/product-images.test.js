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
    const url = new URL(selected);
    assert.equal(url.protocol, 'https:');
    assert.ok(['kss.uz', 'mfs.ezvizlife.com', 'static.tp-link.com'].includes(url.hostname));
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
