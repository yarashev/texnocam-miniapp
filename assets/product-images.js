// Reviewed exact-model replacements; administrator choices remain authoritative.
(() => {
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const bundled = [
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
  const entries = [...bundled, ...(window.UzCamReviewedPhotos || []).map(([brand, model, previousImage, image]) => ({ brand, model, previousImage, image }))];
  const byModel = new Map(), fallbacks = new Map();
  const key = (brand, model) => normalize(brand) + ':' + normalize(model);
  for (const entry of entries) {
    const modelKey = key(entry.brand, entry.model);
    if (!byModel.has(modelKey)) byModel.set(modelKey, []);
    byModel.get(modelKey).push(entry);
    if (entry.previousImage && entry.previousImage.startsWith('assets/')) {
      if (!fallbacks.has(entry.image)) fallbacks.set(entry.image, []);
      fallbacks.get(entry.image).push(entry);
    }
  }
  function resolve(brand, model, original = '') {
    const entry = byModel.get(key(brand, model))?.find(photo => original === photo.previousImage || original === photo.image);
    return entry ? entry.image : original;
  }
  function onImageError(event) {
    const image = event.target;
    if (image?.tagName !== 'IMG' || image.dataset.reviewedFallbackUsed) return;
    const choices = fallbacks.get(image.getAttribute('src'));
    if (!choices?.length) return;
    const alt = normalize(image.alt);
    const entry = choices.find(photo => alt.includes(normalize(photo.model))) || choices[0];
    image.dataset.reviewedFallbackUsed = '1';
    image.hidden = false;
    image.src = entry.previousImage;
    // The legacy inline error handler should run only if the fallback also fails.
    event.stopImmediatePropagation();
  }
  if (typeof document !== 'undefined') document.addEventListener('error', onImageError, true);
  window.UzCamProductImages = { resolve };
})();
