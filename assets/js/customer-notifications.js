(() => {
  const button = document.querySelector('#customerNotificationsButton');
  const panel = document.querySelector('#customerNotificationsPanel');
  if (!button || !panel) return;
  const initData = () => window.Telegram?.WebApp?.initData || '';
  const el = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = value; return node; };
  async function load(action = '') {
    panel.hidden = false;
    panel.replaceChildren(el('p', 'notification-loading', 'Xabarnomalar yuklanmoqda…'));
    const data = initData();
    if (!data) { panel.replaceChildren(el('p', 'notification-empty', 'Xabarnomalarni ko‘rish uchun UzCam Mini App’ni Telegram ichidan oching.')); return; }
    try {
      const response = await fetch('/api/customer/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: data, action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Xabarnomalarni yuklab bo‘lmadi');
      panel.replaceChildren();
      if (!result.botStarted) panel.append(el('p', 'notification-optin', 'Telegram botda /start buyrug‘ini yuboring. Shundan keyin buyurtma xabarlari shaxsiy chatga yetkaziladi.'));
      if (!result.notifications?.length) panel.append(el('p', 'notification-empty', 'Hozircha buyurtma xabarlari yo‘q.'));
      for (const item of result.notifications || []) {
        const card = el('article', 'customer-notification' + (item.read_at ? '' : ' unread'));
        card.append(el('strong', 'notification-title', item.title || 'UzCam xabari'));
        card.append(el('p', 'notification-message', item.message || ''));
        const meta = el('small', 'notification-meta', new Date(item.created_at).toLocaleString('uz-UZ') + ' · ' + (item.delivery_status === 'sent' ? 'Yuborildi' : item.delivery_status === 'failed' ? 'Yuborilmadi' : 'Navbatda'));
        card.append(meta); panel.append(card);
      }
      if (result.unreadCount > 0) {
        const read = el('button', 'notification-read-button', 'Barchasini o‘qilgan deb belgilash');
        read.type = 'button'; read.addEventListener('click', () => load('read')); panel.append(read);
      }
    } catch (error) { panel.replaceChildren(el('p', 'notification-error', error.message)); }
  }
  button.addEventListener('click', () => { if (panel.hidden) load(); else panel.hidden = true; });
})();