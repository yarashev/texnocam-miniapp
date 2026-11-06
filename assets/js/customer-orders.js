(() => {
  const button = document.querySelector('#customerOrdersButton');
  const panel = document.querySelector('#customerOrdersPanel');
  if (!button || !panel) return;
  const initData = () => window.Telegram?.WebApp?.initData || '';
  const labels = {
    pending_payment: 'To‘lov kutilmoqda', paid: 'To‘lov tasdiqlandi',
    assigned: 'Ustaga biriktirildi', in_service: 'Xizmat bajarilmoqda',
    completed: 'Yakunlandi', cancelled: 'Bekor qilindi'
  };
  const paymentLabels = { pending: 'Kutilmoqda', proof_submitted: 'Chek yuborildi', confirmed: 'Tasdiqlandi', rejected: 'Rad etildi', refunded: 'Qaytarildi' };
  const money = value => new Intl.NumberFormat('uz-UZ').format(Number(value) || 0) + ' so‘m';
  const node = (tag, cls, value) => { const el = document.createElement(tag); if (cls) el.className = cls; if (value !== undefined) el.textContent = value; return el; };
  const date = value => value ? new Date(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z')).toLocaleString('uz-UZ') : '—';
  function render(orders) {
    panel.replaceChildren();
    if (!orders.length) { panel.append(node('p','customer-orders-empty','Hozircha buyurtmalaringiz yo‘q.')); return; }
    for (const order of orders) {
      const card = node('article','customer-order-card');
      const head = node('div','customer-order-head');
      head.append(node('strong','customer-order-number',order.order_number));
      head.append(node('span','customer-order-status status-'+order.status,labels[order.status] || order.status));
      card.append(head);
      card.append(node('p','customer-order-date','Sana: '+date(order.created_at)));
      const lines = node('div','customer-order-items');
      for (const item of order.items || []) {
        const line = node('div','customer-order-item');
        line.append(node('span','', (item.name || item.model) + ' × ' + item.quantity));
        line.append(node('b','',money(item.line_total_uzs)));
        lines.append(line);
      }
      card.append(lines);
      const details = node('div','customer-order-total');
      details.append(node('span','','To‘lov: '+(paymentLabels[order.payment_status] || order.payment_status)));
      details.append(node('strong','',money(order.total_uzs)));
      card.append(details);
      if (order.history?.length) {
        const history = node('details','customer-order-history');
        history.append(node('summary','','Holatlar tarixi'));
        const list = node('ol','');
        for (const event of order.history) {
          const text = event.type === 'status'
            ? (labels[event.from] || event.from || 'Yaratildi') + ' → ' + (labels[event.to] || event.to)
            : event.type === 'created' ? 'Buyurtma yaratildi' : event.type === 'payment' ? (event.action === 'confirm_payment' ? 'To‘lov tasdiqlandi' : event.action === 'reject_payment' ? 'To‘lov rad etildi' : 'To‘lov holati yangilandi') : 'Holat yangilandi';
          const li = node('li','',text+' · '+date(event.at));
          list.append(li);
        }
        if (!order.history.some(event => event.type === 'status' && event.to === order.status)) {
          list.append(node('li','','Joriy holat: '+(labels[order.status] || order.status)+' · '+date(order.updated_at)));
        }
        history.append(list); card.append(history);
      } else {
        card.append(node('p','customer-order-current','Joriy holat: '+(labels[order.status] || order.status)));
      }
      panel.append(card);
    }
  }
  async function load() {
    panel.hidden = false;
    panel.replaceChildren(node('p','customer-orders-loading','Buyurtmalar yuklanmoqda…'));
    const data = initData();
    if (!data) { panel.replaceChildren(node('p','customer-orders-empty','Buyurtmalarni ko‘rish uchun Mini App’ni Telegram ichidan oching.')); return; }
    try {
      const response = await fetch('/api/customer/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:data})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Buyurtmalarni yuklab bo‘lmadi');
      render(result.orders || []);
    } catch (error) { panel.replaceChildren(node('p','customer-orders-error',error.message)); }
  }
  const style = document.createElement('style');
  style.textContent = `
    .customer-orders-panel{margin-top:12px;display:grid;gap:10px}.customer-orders-panel[hidden]{display:none}
    .customer-order-card{background:#f7f9fc;border:1px solid #e4eaf3;border-radius:14px;padding:13px;text-align:left}
    .customer-order-head,.customer-order-item,.customer-order-total{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .customer-order-number{font-size:14px}.customer-order-status{font-size:11px;font-weight:700;background:#e8efff;color:#2459bd;padding:6px 9px;border-radius:20px}
    .customer-order-status.status-completed{background:#e5f7ec;color:#168044}.customer-order-status.status-cancelled{background:#ffebeb;color:#b42318}
    .customer-order-date,.customer-order-current{font-size:12px;color:#697586;margin:8px 0}
    .customer-order-items{display:grid;gap:7px;padding:9px 0;border-top:1px solid #e4eaf3;border-bottom:1px solid #e4eaf3;font-size:12px}
    .customer-order-total{padding-top:9px;font-size:12px}.customer-order-history{margin-top:10px;font-size:12px;color:#475467}
    .customer-order-history summary{cursor:pointer;font-weight:700}.customer-order-history ol{padding-left:20px;display:grid;gap:7px}
    .customer-orders-empty,.customer-orders-loading,.customer-orders-error{font-size:13px;color:#697586;padding:10px}
  `;
  document.head.append(style);
  button.addEventListener('click',()=>{if(panel.hidden)load();else panel.hidden=true;});
})();