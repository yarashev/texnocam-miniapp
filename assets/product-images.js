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
  },
  { "brand": "Tapo", "model": "Tapo C120 (4MP WIFI )", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C120_EU_1.0_overview_01_normal_20250306073148g.png" },
  { "brand": "Tapo", "model": "Tapo C225 (4MP WIFI 360)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C225_US_2.0_overview%400.5x_normal_20240117231339t.png" },
  { "brand": "Tapo", "model": "Tapo C245D (3MP WIFI 2-CAM 360)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C245D_UN_1.0_Overview_normal_20251126053636j.png" },
  { "brand": "Tapo", "model": "Tapo C246D (3MP WIFI 2-CAM 360)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C246D_UN_1.0_product_images_01_normal_20250519022854b.png" },
  { "brand": "Tapo", "model": "Tapo C250 (8MP Wifi 360)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C250_US_1.0_overview_normal_20250908030256v.png" },
  { "brand": "Tapo", "model": "Tapo C200C (2MP WIFI 360)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C200_EU_5.0_overview_1_pack_normal_20241226064227u.png" },
  { "brand": "Tapo", "model": "Tapo C210P2 (3MP WIFI 360 2PCS)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C210%282-pack%29_normal_20240624092213x.png" },
  { "brand": "Tapo", "model": "Tapo C201 (2MP WIFI 360 Black)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C201_US_1.0_overview_1.%E3%80%82_normal_20241226062547t.png" },
  { "brand": "Tapo", "model": "Tapo C610 KIT (3MP WIFI 360 SOLAR)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C610_KIT_UN_1.0_Product_Images_01_normal_20250625082811j.png" },
  { "brand": "Tapo", "model": "Tapo C520WS (4MP WIFI 360 LAN)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C520WS_EU_2.0_overview_01_normal_20250307092722e.png" },
  { "brand": "Tapo", "model": "Tapo C510W (3MP WIFI 360)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C510W_EU_2.0_overview_01_normal_20250307092700u.png" },
  { "brand": "Tapo", "model": "Tapo C325WB  (4MP WIFI POE)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C325WB_EU_2.0_overview_01_normal_20241221061227k.png" },
  { "brand": "Tapo", "model": "Tapo C320WS  (4MP WIFI LAN)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C320WS_Tapo_C320WSP2_EU_2_normal_20231019030522r.png" },
  { "brand": "Tapo", "model": "Tapo C310 (3MP WIFI LAN)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C310_EU_1_normal_20230712010611v.png" },
  { "brand": "Tapo", "model": "Tapo C216 (3MP WIFI 360 Valli )", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C216_EU_1.0_overview_normal_20250401093841y.png" },
  { "brand": "Tapo", "model": "Tapo C206 (2MP WIFI 360 Valli )", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C206_EU_1.0_overview_normal_20250321074953d.png" },
  { "brand": "Tapo", "model": "Tapo C236 (5MP WIFI 360 Valli )", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_C236_EU_1.0_overview_normal_20250618013724r.png" },
  { "brand": "Tapo", "model": "Tapo DL110 (Дверной замок Smart Wi-Fi)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_DL110_US_2.6_overview_compressed_normal_20250909065516o.png" },
  { "brand": "Tapo", "model": "Tapo D210 ( 3MP DOMOFON)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_D210_EU_2.0_Overview_01_normal_20250922080132b.png" },
  { "brand": "Tapo", "model": "Tapo D230S1 ( 5MP DOMOFON)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/D230_normal_20241101063325n.png" },
  { "brand": "Tapo", "model": "Tapo C425 (4MP WIFI BATTERY)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-line/01_normal_20231027074200e.jpg" },
  { "brand": "Tapo", "model": "Tapo C410 KIT (3MP WIFI SOLAR)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-line/1-pack_normal_20240328085758m.png" },
  { "brand": "Tapo", "model": "Tapo C615G KIT (3MP 4G 360 SOLAR)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-line/Tapo_C615G_KIT_EU_1.0_overview_01-3_normal_20250716092755m.jpg" },
  { "brand": "Tapo", "model": "Tapo C675D KIT (8MP WIFI 2-CAM Солнечный)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-line/Tapo-C675D-KIT_2000x2000-new_01_normal_20260416164001r.jpg" },
  { "brand": "Tapo", "model": "Tapo A201 (SOLAR PANEL 5.2V  2.5W)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-header/Tapo_A201_UN_2.20_Overview_01_normal_20250717061053i.png" },
  { "brand": "Tapo", "model": "Tapo C425 (4MP WIFI BATTERY)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-line/01_normal_20231027074200e.jpg" },
  { "brand": "Tapo", "model": "Tapo C410 KIT (3MP WIFI SOLAR)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-line/1-pack_normal_20240328085758m.png" },
  { "brand": "Tapo", "model": "Tapo C615G KIT (3MP 4G 360 SOLAR)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-line/Tapo_C615G_KIT_EU_1.0_overview_01-3_normal_20250716092755m.jpg" },
  { "brand": "Tapo", "model": "Tapo C675D KIT (8MP WIFI 2-CAM Солнечный)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-line/Tapo-C675D-KIT_2000x2000-new_01_normal_20260416164001r.jpg" },
  { "brand": "TP-Link", "model": "Tp-Link ER605 (VPN‑Gateway)", "previousImage": "", "image": "https://static.tp-link.com/upload/image-line/ER605_V2_VPN_Load_Balance_Router_01_normal_20211125084350a.jpg" },
  { "brand": "Mercusys", "model": "Mercusys Halo H27BE(3-pack BE3600 WIFI 7)", "previousImage": "", "image": "https://static.mercusys.com/product-image/Halo_H27BE_3-pack_EU_1.0_01_normal20250103015914.jpg" },
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
