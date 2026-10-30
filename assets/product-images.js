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
  // Dahua catalog was imported from the 2024 price list without image_path values.
  // Exact-model results take precedence; a model-family fallback keeps every imported product visual.
  const dahuaExact = new Map([
    ['dhipchdbw1230eps5','https://xmall.bg/cdn/img/products/9940/ip-kamera-dahua-ipc-hfw2831s-s-0280b-s2-image_645a5ad65b92b.png?height=800&v=1777612806&width=800'],
    ['dhipchfw1431s1as4','https://xmall.bg/cdn/img/products/9940/ip-kamera-dahua-ipc-hfw2831s-s-0280b-s2-image_645a5ad65b92b.png?height=800&v=1777612806&width=800'],
    ['dhipchdbw1431eps4','https://xmall.bg/cdn/img/products/9940/ip-kamera-dahua-ipc-hfw2831s-s-0280b-s2-image_645a5ad65b92b.png?height=800&v=1777612806&width=800'],
    ['dhipchfw1431tzs2812s4','https://xmall.bg/cdn/img/products/9940/ip-kamera-dahua-ipc-hfw2831s-s-0280b-s2-image_645a5ad65b92b.png?height=800&v=1777612806&width=800'],
    ['dhipchfw2431spss2','https://www.static-src.com/wcsstore/Indraprastha/images/catalog/full/catalog-image/110/MTA-96169925/dahua_ip_cam_dahua_ipc_hfw2431sp_s_s2_bullet_4mp_full01_cn5cs0xd.jpeg'],
    ['dhipchfw2831sps0280bs2','https://xmall.bg/cdn/img/products/9940/ip-kamera-dahua-ipc-hfw2831s-s-0280b-s2-image_645a5ad65b92b.png?height=800&v=1777612806&width=800'],
    ['dhinvr1104hss3h','https://techonline.vn/media/product/1945-4-kenh-dahua-dhi-nvr1104hs-s3h.jpg'],
    ['dhxvr1b04i','https://techonline.vn/media/product/1984-dahua-dh-xvr1b04-i.jpg'],
    ['dhpfs30064et60','https://cf.shopee.co.th/file/831a681d6f9bfd90e9f37f78062d69c1']
  ]);
  const dahuaFallback = model => {
    const value = normalize(model);
    if (dahuaExact.has(value)) return dahuaExact.get(value);
    if (value.startsWith('dhipchdbw') || value.startsWith('dhipchdw')) return 'https://xmall.bg/cdn/img/products/9940/ip-kamera-dahua-ipc-hfw2831s-s-0280b-s2-image_645a5ad65b92b.png?height=800&v=1777612806&width=800';
    if (value.startsWith('dhipchfw') || value.startsWith('dhipck')) return 'https://www.static-src.com/wcsstore/Indraprastha/images/catalog/full/catalog-image/110/MTA-96169925/dahua_ip_cam_dahua_ipc_hfw2431sp_s_s2_bullet_4mp_full01_cn5cs0xd.jpeg';
    if (value.startsWith('dhsd') || value.startsWith('dhiitc')) return 'https://xmall.bg/cdn/img/products/9940/ip-kamera-dahua-ipc-hfw2831s-s-0280b-s2-image_645a5ad65b92b.png?height=800&v=1777612806&width=800';
    if (value.startsWith('dhinvr')) return 'https://techonline.vn/media/product/1945-4-kenh-dahua-dhi-nvr1104hs-s3h.jpg';
    if (value.startsWith('dhxvr')) return 'https://techonline.vn/media/product/1984-dahua-dh-xvr1b04-i.jpg';
    if (value.startsWith('dhpfs')) return 'https://cf.shopee.co.th/file/831a681d6f9bfd90e9f37f78062d69c1';
    if (value.startsWith('dhivto') || value.startsWith('dhivth')) return 'https://down-ph.img.susercontent.com/file/sg-11134202-7rdxg-mdo9dy8pazjecf';
    if (value.startsWith('dhiasi')) return 'https://c1.neweggimages.com/ProductImage/AE0B_131796592474526931qrb5NJPqGY.jpg';
    return '';
  };
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
    if (entry) return entry.image;
    if (normalize(brand) === 'dahua' && !original) return dahuaFallback(model);
    return original;
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
