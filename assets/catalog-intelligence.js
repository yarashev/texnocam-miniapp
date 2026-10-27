(() => {
  const STORAGE_KEY = 'uzcam-catalog-signals-v1';
  const safeText = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char]));
  const normalize = value => String(value || '').toLocaleLowerCase('uz').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9а-яё]+/gi, ' ').trim();
  const loadSignals = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} } };
  const saveSignals = signals => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(signals)) } catch {} };
  const track = (kind, id) => {
    if (!Number.isFinite(Number(id))) return;
    const signals = loadSignals();
    const item = signals[id] || { views: 0, adds: 0, updatedAt: 0 };
    if (kind === 'view') item.views = Math.min(50, item.views + 1);
    if (kind === 'add') item.adds = Math.min(30, item.adds + 1);
    item.updatedAt = Date.now(); signals[id] = item; saveSignals(signals);
  };
  const score = (product, query, signals) => {
    const signal = signals[product.id] || {}; const name = normalize(product.name); const brand = normalize(product.brand); const spec = normalize(product.spec); let value = 0;
    for (const token of query.split(' ').filter(Boolean)) {
      if (name === token || name.startsWith(token)) value += 180;
      else if (name.includes(token)) value += 110;
      if (brand.startsWith(token)) value += 75;
      else if (brand.includes(token)) value += 45;
      if (spec.includes(token)) value += 25;
    }
    value += Number(product.views || 0) * 0.25 + Number(product.cartAdds || 0) * 4 + Number(product.soldQty || 0) * 6;
    value += Number(signal.views || 0) * 3 + Number(signal.adds || 0) * 18;
    return value;
  };
  const relatedCategories = category => ({
    'Kameralar': ['Xotira qurilmalari', 'Quvvat, UPS va aksessuarlar', 'Kabel va optika'],
    'DVR/NVR': ['Xotira qurilmalari', 'Kabel va optika', 'Quvvat, UPS va aksessuarlar'],
    'Tarmoq uskunalari': ['Kabel va optika', 'Quvvat, UPS va aksessuarlar'],
    'Domofon va kirish nazorati': ['Kabel va optika', 'Quvvat, UPS va aksessuarlar']
  }[category] || []);
  const renderBundle = () => {
    const existing = document.querySelector('#smartBundle');
    const state = window.UzCamCatalogState; const categories = relatedCategories(state?.activeCategory);
    if (!categories.length) { existing?.remove(); return; }
    const host = existing || document.createElement('aside');
    host.id = 'smartBundle'; host.className = 'smart-bundle';
    host.innerHTML = '<div><b>Kamera bilan birga kerak bo‘lishi mumkin</b><small>To‘plamni to‘ldiring va vaqtni tejang</small></div><div class="bundle-links">' + categories.map(category => '<button type="button" data-related-category="' + safeText(category) + '">' + safeText(category) + '</button>').join('') + '</div>';
    if (!existing) document.querySelector('#products')?.before(host);
    host.querySelectorAll('[data-related-category]').forEach(button => button.onclick = () => {
      state.activeCategory = button.dataset.relatedCategory; state.visibleLimit = 40; state.renderCats(); state.renderProducts();
    });
  };
  window.UzCamCatalogIntelligence = { track, relatedCategories };
  const install = () => {
    const state = window.UzCamCatalogState;
    if (!state || typeof state.renderProducts !== 'function' || !Array.isArray(state.items)) return;
    state.renderProducts = function renderProducts(reset = true) {
      if (reset) state.visibleLimit = 40;
      const query = normalize(document.querySelector('#search')?.value);
      const tokens = query.split(/\s+/).filter(Boolean);
      const matching = state.items.filter(product =>
        (state.activeCategory === 'Barchasi' || product.cat === state.activeCategory) &&
        (state.activeBrand === 'Barcha brendlar' || product.brand === state.activeBrand) &&
        tokens.every(token => [product.name, product.spec, product.cat, product.brand].some(field => normalize(field).includes(token))));
      const signals = loadSignals();
      const ranked = matching.slice().sort((left, right) => score(right, query, signals) - score(left, query, signals) || Number(left.price) - Number(right.price) || String(left.name).localeCompare(String(right.name), 'uz'));
      const byPrice = ranked.slice().sort((left, right) => Number(left.price) - Number(right.price));
      let shown = ranked;
      if (state.priceTier !== 'all') {
        const first = Math.ceil(byPrice.length / 3), second = Math.ceil(byPrice.length * 2 / 3);
        const band = state.priceTier === 'cheap' ? byPrice.slice(0, first) : state.priceTier === 'medium' ? byPrice.slice(first, second) : byPrice.slice(second).reverse();
        shown = band.sort((left, right) => score(right, query, signals) - score(left, query, signals));
      }
      const count = document.querySelector('#countLabel'), filterCount = document.querySelector('#filterCount'), host = document.querySelector('#products'), loadMore = document.querySelector('#loadMoreWrap');
      if (!host) return;
      if (count) count.textContent = shown.length + ' ta mahsulot';
      if (filterCount) filterCount.textContent = shown.length ? Math.min(state.visibleLimit, shown.length) + ' / ' + shown.length : '';
      const visible = shown.slice(0, state.visibleLimit);
      host.innerHTML = visible.length ? visible.map(product => '<article class="product" data-product-id="' + Number(product.id) + '"><div class="photo">' + (product.badge ? '<span class="badge">' + safeText(product.badge) + '</span>' : '') + (product.image ? '<img src="' + safeText(product.image) + '" alt="' + safeText(product.name) + '" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="placeholder" hidden>' + safeText(product.icon || '⚙️') + '</span>' : '<span class="placeholder">' + safeText(product.icon || '📦') + '</span>') + '</div><div class="name">' + safeText(product.name) + '</div><div class="meta">' + safeText(product.brand) + ' · ' + safeText(product.spec || product.cat) + '</div><div class="buyrow"><span class="price">' + new Intl.NumberFormat('uz-UZ').format(product.price) + ' so‘m</span><button class="add" data-add="' + Number(product.id) + '" aria-label="Savatchaga qo‘shish">+</button></div></article>').join('') : '<div class="empty">' + (query ? 'Mahsulot topilmadi 🔎' : 'Bu bo‘limda mahsulotlar hali kiritilmagan.') + '</div>';
      if (loadMore) loadMore.innerHTML = shown.length > state.visibleLimit ? '<button class="load-more" id="loadMore">Ko‘proq mahsulot</button>' : '';
      document.querySelector('#loadMore')?.addEventListener('click', () => { state.visibleLimit += 40; state.renderProducts(false); });
      host.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); track('add', Number(button.dataset.add)); state.add(Number(button.dataset.add)); }));
      host.querySelectorAll('[data-product-id]').forEach(card => card.addEventListener('click', () => track('view', Number(card.dataset.productId)), { once: true }));
      renderBundle(); window.UzCamCatalogControls?.refresh();
    };
    state.renderProducts();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

