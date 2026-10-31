(() => {
  const state = window.UzCamCatalogState;
  if (!state) return;
  const money = value => new Intl.NumberFormat('uz-UZ').format(value) + ' so‘m';
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const dialog = node('dialog', 'product-detail');
  dialog.setAttribute('aria-labelledby', 'productDetailTitle');
  const zoom = node('dialog', 'product-zoom');
  zoom.setAttribute('aria-label', 'Mahsulot rasmini kattalashtirib ko‘rish');
  document.body.append(dialog, zoom);
  const openDialog = target => {
    if (typeof target.showModal === 'function') target.showModal();
    else { target.setAttribute('open', ''); target.classList.add('dialog-fallback'); }
  };
  const closeDialog = target => {
    if (typeof target.close === 'function') target.close();
    else if (target.hasAttribute('open')) { target.removeAttribute('open'); target.dispatchEvent(new Event('close')); }
  };
  let previousFocus, previousOverflow, closingFromTelegramBack = false, closingZoomFromTelegramBack = false;
  function closeButton(label, action) {
    const button = node('button', 'detail-close', '✕');
    button.type = 'button'; button.setAttribute('aria-label', label);
    button.onclick = action; return button;
  }
  function image(product, className) {
    const holder = node('div', className);
    const fallback = node('span', 'detail-image-fallback', 'Rasm mavjud emas');
    if (product.image) {
      const img = node('img'); img.src = product.image; img.alt = product.name;
      img.decoding = 'async'; img.loading = className === 'detail-related-photo' ? 'lazy' : 'eager'; img.onerror = () => { img.remove(); holder.append(fallback); };
      holder.append(img);
    } else holder.append(fallback);
    return holder;
  }
  function addButton(product, className = 'detail-add') {
    const button = node('button', className, 'Savatga qo‘shish'); button.type = 'button';
    button.onclick = () => {
      window.UzCamCatalogIntelligence?.track('add', product.id);
      state.add(Number(product.id));
      button.textContent = 'Qo‘shildi ✓';
      setTimeout(() => { button.textContent = 'Savatga qo‘shish'; }, 1000);
    };
    return button;
  }
  function related(product) {
    const compatible = window.UzCamProductRecommendations?.for(product);
    if (compatible?.length) return compatible;
    return state.items.filter(item => item.id !== product.id && item.cat === product.cat)
      .map(item => ({ item, score: (item.brand === product.brand ? 2 : 0) - Math.abs(Number(item.price) - Number(product.price)) / Math.max(Number(product.price), 1) }))
      .sort((a, b) => b.score - a.score || Number(a.item.id) - Number(b.item.id))
      .slice(0, 6).map(entry => entry.item);
  }
  function open(id) {
    const product = state.items.find(item => Number(item.id) === Number(id));
    if (!product) return;
    if (!dialog.open) window.UzCamTelegramBack?.push(() => { closingFromTelegramBack = true; closeDialog(dialog); });
    if (!dialog.open) {
      previousFocus = document.activeElement; previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    dialog.replaceChildren();
    const header = node('header', 'detail-header');
    header.append(node('span', '', 'Mahsulot haqida'), closeButton('Mahsulotni yopish', () => closeDialog(dialog)));
    const content = node('div', 'detail-content');
    const photo = node('button', 'detail-photo-button'); photo.type = 'button';
    photo.setAttribute('aria-label', 'Rasmni kattalashtirish');
    photo.append(image(product, 'detail-photo'));
    photo.disabled = !product.image;
    photo.onclick = () => {
      window.UzCamTelegramBack?.push(() => { closingZoomFromTelegramBack = true; closeDialog(zoom); }, 'product-zoom');
      zoom.replaceChildren(closeButton('Rasmni yopish', () => closeDialog(zoom)), image(product, 'zoom-photo'));
      openDialog(zoom);
    };
    const title = node('h1', '', product.name); title.id = 'productDetailTitle';
    const price = node('div', 'detail-price', money(product.price));
    const info = node('section', 'detail-info');
    info.append(node('h2', '', 'Mahsulot ma’lumotlari'));
    const list = node('dl');
    [['Brend', product.brand], ['Model', product.model || product.name], ['Kategoriya', product.cat]].forEach(([label, value]) => {
      list.append(node('dt', '', label), node('dd', '', value || 'Ko‘rsatilmagan'));
    });
    info.append(list, node('p', 'detail-description', product.spec || 'Qo‘shimcha ma’lumot hali kiritilmagan.'));
    content.append(photo, title, price, info);
    const recommendations = related(product);
    if (recommendations.length) {
      const section = node('section', 'detail-related'); section.append(node('h2', '', window.UzCamProductRecommendations?.label(product) || 'O‘xshash mahsulotlar'));
      const grid = node('div', 'detail-related-grid');
      recommendations.forEach(item => {
        const card = node('article', 'detail-related-card');
        const link = node('button', 'detail-related-open'); link.type = 'button';
        link.append(image(item, 'detail-related-photo'), node('h3', '', item.name));
        link.onclick = () => open(item.id);
        card.append(link, node('div', 'detail-related-price', money(item.price)), addButton(item, 'detail-related-add'));
        grid.append(card);
      });
      section.append(grid); content.append(section);
    }
    const footer = node('footer', 'detail-footer');
    footer.append(node('strong', '', money(product.price)), addButton(product));
    dialog.append(header, content, footer);
    if (!dialog.open) openDialog(dialog);
    dialog.scrollTop = 0; header.querySelector('button').focus();
    window.UzCamCatalogIntelligence?.track('view', product.id);
  }
  dialog.addEventListener('close', () => {
    if (zoom.open) closeDialog(zoom);
    if (!closingFromTelegramBack) window.UzCamTelegramBack?.discard();
    closingFromTelegramBack = false;
    document.body.style.overflow = previousOverflow || '';
    previousFocus?.focus({ preventScroll: true });
  });
  zoom.addEventListener('close', () => {
    if (!closingZoomFromTelegramBack) window.UzCamTelegramBack?.discard('product-zoom');
    closingZoomFromTelegramBack = false;
  });
  zoom.addEventListener('click', event => { if (event.target === zoom) closeDialog(zoom); });
  document.querySelector('#products')?.addEventListener('click', event => {
    if (event.target.closest('[data-add]')) return;
    const card = event.target.closest('[data-product-id]'); if (card) open(card.dataset.productId);
  });
  document.querySelector('#products')?.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key) || event.target.closest('button')) return;
    const card = event.target.closest('[data-product-id]');
    if (card) { event.preventDefault(); open(card.dataset.productId); }
  });
  const enhanceCards = () => document.querySelectorAll('#products [data-product-id]').forEach(card => {
    card.tabIndex = 0; card.setAttribute('aria-label', card.querySelector('.name')?.textContent + ' — ma’lumotlarni ko‘rish');
  });
  const host = document.querySelector('#products');
  if (host) new MutationObserver(enhanceCards).observe(host, { childList: true });
  enhanceCards();
})();
