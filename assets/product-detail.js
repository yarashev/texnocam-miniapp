(() => {
  'use strict';
  const state = window.UzCamCatalogState;
  if (!state) return;

  const money = value => new Intl.NumberFormat('uz-UZ').format(Number(value) || 0) + ' so‘m';
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  // Use ordinary elements instead of the native <dialog> API:
  // this works consistently in mobile browsers and Telegram WebView.
  const panel = make('section', 'product-detail');
  panel.id = 'productDetailPanel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'productDetailTitle');
  document.body.append(panel);

  const zoom = make('div', 'product-zoom');
  zoom.hidden = true;
  zoom.setAttribute('role', 'dialog');
  zoom.setAttribute('aria-modal', 'true');
  zoom.setAttribute('aria-label', 'Mahsulot rasmini kattalashtirib ko‘rish');
  document.body.append(zoom);

  let activeProductId = null;
  let previousFocus = null;
  let backEntryAdded = false;
  let zoomBackEntryAdded = false;
  let closingFromBack = false;
  let closingZoomFromBack = false;

  function closeButton(label, action) {
    const button = make('button', 'detail-close', '✕');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', action);
    return button;
  }

  function productImage(product, className) {
    const holder = make('div', className);
    if (product.image) {
      const img = make('img');
      img.src = product.image;
      img.alt = product.name || 'Mahsulot rasmi';
      img.loading = className === 'detail-related-photo' ? 'lazy' : 'eager';
      img.onerror = () => {
        img.remove();
        holder.append(make('span', 'detail-image-fallback', 'Rasm mavjud emas'));
      };
      holder.append(img);
    } else {
      holder.append(make('span', 'detail-image-fallback', 'Rasm mavjud emas'));
    }
    return holder;
  }

  function addToCart(product, className) {
    const button = make('button', className, 'Savatga qo‘shish');
    button.type = 'button';
    button.addEventListener('click', event => {
      event.stopPropagation();
      window.UzCamCatalogIntelligence?.track('add', product.id);
      state.add(Number(product.id));
      button.textContent = 'Qo‘shildi ✓';
      button.disabled = true;
      window.setTimeout(() => {
        button.textContent = 'Savatga qo‘shish';
        button.disabled = false;
      }, 1000);
    });
    return button;
  }

  function relatedProducts(product) {
    const recommended = window.UzCamProductRecommendations?.for(product);
    if (recommended?.length) return recommended;
    return state.items
      .filter(item => Number(item.id) !== Number(product.id) && item.cat === product.cat)
      .map(item => ({
        item,
        score: (item.brand === product.brand ? 2 : 0) -
          Math.abs(Number(item.price) - Number(product.price)) / Math.max(Number(product.price), 1)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(entry => entry.item);
  }

  function closeZoom(fromBack = false) {
    if (zoom.hidden) return;
    zoom.hidden = true;
    zoom.replaceChildren();
    if (zoomBackEntryAdded && !fromBack) window.UzCamTelegramBack?.discard('product-zoom');
    zoomBackEntryAdded = false;
    closingZoomFromBack = false;
  }

  function showZoom(product) {
    if (!product.image) return;
    zoom.replaceChildren(
      closeButton('Rasmni yopish', () => closeZoom()),
      productImage(product, 'zoom-photo')
    );
    zoom.hidden = false;
    if (!zoomBackEntryAdded) {
      window.UzCamTelegramBack?.push(() => {
        closingZoomFromBack = true;
        closeZoom(true);
      }, 'product-zoom');
      zoomBackEntryAdded = true;
    }
    zoom.querySelector('button')?.focus();
  }

  function closeProduct(fromBack = false) {
    if (panel.hidden) return;
    closeZoom(fromBack);
    panel.hidden = true;
    panel.classList.remove('is-open');
    panel.replaceChildren();
    document.body.style.overflow = '';
    activeProductId = null;
    if (backEntryAdded && !fromBack) window.UzCamTelegramBack?.discard('product-detail');
    backEntryAdded = false;
    closingFromBack = false;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }

  function openProduct(id) {
    const product = state.items.find(item => String(item.id) === String(id));
    if (!product) return;

    if (panel.hidden) {
      previousFocus = document.activeElement;
      document.body.style.overflow = 'hidden';
      window.UzCamTelegramBack?.push(() => {
        closingFromBack = true;
        closeProduct(true);
      }, 'product-detail');
      backEntryAdded = true;
    }

    activeProductId = String(product.id);
    const header = make('header', 'detail-header');
    header.append(
      make('span', '', 'Mahsulot haqida'),
      closeButton('Mahsulotni yopish', () => closeProduct())
    );

    const content = make('div', 'detail-content');
    const photo = make('button', 'detail-photo-button');
    photo.type = 'button';
    photo.setAttribute('aria-label', 'Rasmni kattalashtirish');
    photo.append(productImage(product, 'detail-photo'));
    photo.disabled = !product.image;
    photo.addEventListener('click', () => showZoom(product));

    const title = make('h1', '', product.name || 'Mahsulot');
    title.id = 'productDetailTitle';
    const price = make('div', 'detail-price', money(product.price));
    const info = make('section', 'detail-info');
    info.append(make('h2', '', 'Mahsulot ma’lumotlari'));
    const details = make('dl');
    [['Brend', product.brand], ['Model', product.model || product.name], ['Kategoriya', product.cat]]
      .forEach(([label, value]) => {
        details.append(make('dt', '', label || ''), make('dd', '', value || 'Ko‘rsatilmagan'));
      });
    info.append(details, make('p', 'detail-description', product.spec || 'Qo‘shimcha ma’lumot hali kiritilmagan.'));
    content.append(photo, title, price, info);

    const suggestions = relatedProducts(product);
    if (suggestions.length) {
      const section = make('section', 'detail-related');
      section.append(make('h2', '', window.UzCamProductRecommendations?.label(product) || 'O‘xshash mahsulotlar'));
      const grid = make('div', 'detail-related-grid');
      suggestions.forEach(item => {
        const card = make('article', 'detail-related-card');
        const openButton = make('button', 'detail-related-open');
        openButton.type = 'button';
        openButton.append(productImage(item, 'detail-related-photo'), make('h3', '', item.name));
        openButton.addEventListener('click', () => openProduct(item.id));
        card.append(openButton, make('div', 'detail-related-price', money(item.price)), addToCart(item, 'detail-related-add'));
        grid.append(card);
      });
      section.append(grid);
      content.append(section);
    }

    const footer = make('footer', 'detail-footer');
    footer.append(make('strong', '', money(product.price)), addToCart(product, 'detail-add'));
    panel.replaceChildren(header, content, footer);
    panel.hidden = false;
    panel.classList.add('is-open');
    panel.scrollTop = 0;
    header.querySelector('button')?.focus();
    window.UzCamCatalogIntelligence?.track('view', product.id);
  }

  // One capture-phase listener handles all product cards, including cards
  // recreated later by catalog rendering and filtering.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;
    if (target.closest('[data-add], .add, .camera-add, .detail-add, .detail-related-add')) return;
    const card = target.closest('[data-product-id]');
    if (!card) return;
    const id = card.getAttribute('data-product-id');
    if (!id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openProduct(id);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!zoom.hidden) { closeZoom(); event.preventDefault(); }
      else if (!panel.hidden) { closeProduct(); event.preventDefault(); }
      return;
    }
    if (!['Enter', ' '].includes(event.key)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('button, a, input, textarea, select')) return;
    const card = target.closest('[data-product-id]');
    if (card) {
      event.preventDefault();
      openProduct(card.getAttribute('data-product-id'));
    }
  });

  panel.addEventListener('click', event => {
    if (event.target === panel) closeProduct();
  });

  const improveCards = () => {
    document.querySelectorAll('[data-product-id]').forEach(card => {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', (card.querySelector('.name')?.textContent || 'Mahsulot') + ' — ma’lumotlarni ko‘rish');
    });
  };
  const observer = new MutationObserver(improveCards);
  observer.observe(document.body, { childList: true, subtree: true });
  improveCards();

  // Keep these functions available for diagnostics and controlled navigation.
  window.UzCamProductDetail = { open: openProduct, close: closeProduct, get activeId() { return activeProductId; } };
})();