// Exact-model photo replacements. Preserve images uploaded or chosen by admins.
(() => {
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const photos = [
  {
    "brand": "EZVIZ",
    "model": "CS-H1C (1080P)",
    "previousImage": "assets/ezviz/01.webp",
    "image": "assets/official-products/cs-h1c-1080p.png"
  },
  {
    "brand": "EZVIZ",
    "model": "CS-H6C pro (1080P)",
    "previousImage": "assets/ezviz/02.webp",
    "image": "assets/official-products/cs-h6c-pro-1080p.png"
  },
  {
    "brand": "EZVIZ",
    "model": "CS-H6C pro (4MP)",
    "previousImage": "assets/ezviz/03.webp",
    "image": "assets/official-products/cs-h6c-pro-4mp.png"
  },
  {
    "brand": "EZVIZ",
    "model": "CS-H6c G1 8MP",
    "previousImage": "assets/ezviz/05.webp",
    "image": "assets/official-products/cs-h6c-g1-8mp.png"
  },
  {
    "brand": "EZVIZ",
    "model": "CS-C6N G1 (3MP)",
    "previousImage": "",
    "image": "assets/official-products/cs-c6n-g1-3mp.png"
  },
  {
    "brand": "EZVIZ",
    "model": "CS-C6N G1 (5MP)",
    "previousImage": "assets/ezviz/07.webp",
    "image": "assets/official-products/cs-c6n-g1-5mp.png"
  },
  {
    "brand": "EZVIZ",
    "model": "CS-C6N G1 (8MP)",
    "previousImage": "assets/ezviz/08.webp",
    "image": "assets/official-products/cs-c6n-g1-8mp.png"
  }
];
  function resolve(brand, model, original = '') {
    const entry = photos.find(photo => normalize(photo.brand) === normalize(brand) && normalize(photo.model) === normalize(model));
    return entry && (original === entry.previousImage || original === entry.image) ? entry.image : original;
  }
  window.UzCamProductImages = { resolve };
})();
