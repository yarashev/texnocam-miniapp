import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../assets/product-images.js', import.meta.url), 'utf8'), context);
const { resolve } = context.window.UzCamProductImages;
const sources = JSON.parse(fs.readFileSync(new URL('../assets/official-products/sources.json', import.meta.url), 'utf8'));

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
