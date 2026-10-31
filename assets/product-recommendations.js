(() => {
  const text = product => [product.model, product.name, product.spec, product.cat].join(' ').toUpperCase();
  const role = product => {
    const value = text(product);
    if (/\bNVR\b|\bXVR\b|\bDVR\b/.test(value) || /NVR/.test(product.cat || '')) return 'recorder';
    if (/\bDH-IPC\b|\bIPC-[A-Z0-9]|\bDS-2CD\b|\bDS-2CE\b/.test(value) || product.cat === 'Kameralar') return 'camera';
    if (/\bPOE\b|\bSWI?TCH\b|\bCPE\b|\bROUTER\b|\bDH-PFS\b/.test(value) || product.cat === 'Tarmoq uskunalari') return 'network';
    if (/\bHDD\b|\bSSD\b|\bMICRO ?SD\b|\bMEMORY CARD\b/.test(value) || product.cat === 'Xotira qurilmalari') return 'storage';
    if (/\bUTP\b|\bFTP\b|\bCABLE\b|\bKABEL\b|\bOPTIC\b|\bFIBER\b|\bPATCH/.test(value) || product.cat === 'Kabel va optika') return 'cable';
    return 'other';
  };
  const score = (base, item) => {
    const baseRole = role(base), itemRole = role(item), itemText = text(item);
    const sameBrand = String(base.brand).toLowerCase() === String(item.brand).toLowerCase() ? 12 : 0;
    const popularity = Number(item.soldQty || 0) * 8 + Number(item.cartAdds || 0) * 3 + Number(item.views || 0) * .2;
    let intent = 0;
    if (baseRole === 'camera') {
      if (itemRole === 'recorder') intent = item.cat === 'Dahua NVR' && base.brand === 'Dahua' ? 120 : 100;
      if (itemRole === 'network') intent = /POE|PFS|SWITCH/.test(itemText) ? 88 : 72;
      if (itemRole === 'cable') intent = 66;
      if (itemRole === 'storage') intent = 58;
    } else if (baseRole === 'recorder') {
      if (itemRole === 'camera') intent = sameBrand + 115;
      if (itemRole === 'network') intent = /POE|PFS|SWITCH/.test(itemText) ? 86 : 68;
      if (itemRole === 'cable') intent = 64;
      if (itemRole === 'storage') intent = 74;
    } else if (baseRole === 'network') {
      if (itemRole === 'camera') intent = 86;
      if (itemRole === 'cable') intent = 78;
      if (itemRole === 'recorder') intent = 65;
    } else if (baseRole === 'storage') {
      if (itemRole === 'recorder') intent = 92;
      if (itemRole === 'camera') intent = 62;
    } else if (baseRole === 'cable') {
      if (itemRole === 'camera') intent = 76;
      if (itemRole === 'network') intent = 71;
    }
    return intent ? intent + popularity + sameBrand : -Infinity;
  };
  const label = product => {
    const type = role(product);
    if (type === 'camera') return 'Kamera uchun mos qurilmalar';
    if (type === 'recorder') return 'NVR/DVR uchun mos qurilmalar';
    if (type === 'network') return 'Tarmoq qurilmasi uchun tavsiyalar';
    return 'Birga kerak bo‘lishi mumkin';
  };
  const forProduct = product => {
    const limits = { recorder: 1, camera: 3, network: 1, cable: 1, storage: 1 };
    const candidates = [];
    for (const item of window.UzCamCatalogState?.items || []) {
      if (String(item.id) === String(product.id)) continue;
      const itemRole = role(item);
      const itemScore = score(product, item);
      if (!Number.isFinite(itemScore)) continue;
      const entry = { item, score: itemScore, role: itemRole };
      let position = candidates.findIndex(current =>
        itemScore > current.score ||
        (itemScore === current.score && Number(item.price) < Number(current.item.price))
      );
      if (position < 0) position = candidates.length;
      candidates.splice(position, 0, entry);
      if (candidates.length > 24) candidates.pop();
    }
    const counts = Object.create(null);
    const selected = [];
    for (const entry of candidates) {
      const max = limits[entry.role] || 1;
      if ((counts[entry.role] || 0) >= max) continue;
      counts[entry.role] = (counts[entry.role] || 0) + 1;
      selected.push(entry.item);
      if (selected.length === 6) break;
    }
    return selected;
  };
  window.UzCamProductRecommendations = { for: forProduct, label, role };
})();