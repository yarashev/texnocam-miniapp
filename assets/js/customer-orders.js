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
      const card = node('details','customer-order-card');
      const head = node('summary','customer-order-summary');
      const identity = node('span','customer-order-identity');
      identity.append(node('strong','customer-order-number',order.order_number));
      identity.append(node('small','customer-order-date','Sana: '+date(order.created_at)));
      const overview = node('span','customer-order-overview');
      overview.append(node('span','customer-order-status status-'+order.status,labels[order.status] || order.status));
      overview.append(node('b','customer-order-preview-total',money(order.total_uzs)));
      head.append(identity,overview);
      card.append(head);
      const content = node('div','customer-order-content');
      content.append(node('div','customer-order-section-title','Buyurtma tarkibi'));
      const lines = node('div','customer-order-items');
      for (const item of order.items || []) {
        const line = node('div','customer-order-item');
        const description = node('div','customer-order-item-description');
        description.append(node('strong','customer-order-item-name',(item.name || item.model || 'Mahsulot') + (item.model ? ' · ' + item.model : '')));
        description.append(node('span','customer-order-unit-price',money(item.unit_price_uzs)+' × '+Number(item.quantity || 0)+' dona'));
        line.append(description,node('b','customer-order-line-total',money(item.line_total_uzs)));
        lines.append(line);
      }
      content.append(lines);
      const total = node('div','customer-order-total');
      const totalsLabel = node('span','','Jami to‘lov');
      total.append(totalsLabel,node('strong','',money(order.total_uzs)));
      content.append(total);
      const payment = node('div','customer-order-meta');
      payment.append(node('span','','To‘lov holati'),node('b','',paymentLabels[order.payment_status] || order.payment_status || '—'));
      content.append(payment);
      if (order.delivery_method) content.append(node('p','customer-order-delivery','Yetkazib berish: '+(order.delivery_method === 'bts' ? 'BTS' : 'Manzilga')));
      if (order.history?.length) {
        const history = node('details','customer-order-history');
        history.append(node('summary','','Buyurtma holatlari tarixi'));
        const list = node('ol','');
        for (const event of order.history) {
          const text = event.type === 'status'
            ? (labels[event.from] || event.from || 'Yaratildi') + ' → ' + (labels[event.to] || event.to)
            : event.type === 'created' ? 'Buyurtma yaratildi' : event.type === 'payment' ? (event.action === 'confirm_payment' ? 'To‘lov tasdiqlandi' : event.action === 'reject_payment' ? 'To‘lov rad etildi' : 'To‘lov holati yangilandi') : 'Holat yangilandi';
          list.append(node('li','',text+' · '+date(event.at)));
        }
        if (!order.history.some(event => event.type === 'status' && event.to === order.status)) {
          list.append(node('li','','Joriy holat: '+(labels[order.status] || order.status)+' · '+date(order.updated_at)));
        }
        history.append(list); content.append(history);
      } else {
        content.append(node('p','customer-order-current','Joriy holat: '+(labels[order.status] || order.status)));
      }
      if(order.service){const names={accepted:'Usta qabul qildi',travelling:'Usta yo‘lga chiqdi',working:'Ish bajarilmoqda',awaiting_customer:'Tasdiqlashingiz kutilmoqda',disputed:'Dispetcher ko‘rib chiqmoqda',completed:'Ish tasdiqlangan'};content.append(node('p','customer-order-current','Usta ishi: '+(names[order.service.state]||order.service.state)));if(order.service.state==='awaiting_customer'){const link=node('a','','Tasdiqlash va baholash');link.href='assets/worker-cabinet.html?v=availability-20261113';content.append(link)}if(order.service.rating)content.append(node('p','','Baho: '+order.service.rating+' ⭐'));}
      card.append(content);
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
    .customer-order-card{background:#fff;border:1px solid #e4eaf3;border-radius:14px;text-align:left;overflow:hidden}
    .customer-order-summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px;cursor:pointer}
    .customer-order-summary::-webkit-details-marker{display:none}
    .customer-order-identity,.customer-order-overview{display:grid;gap:5px;min-width:0}
    .customer-order-number{font-size:13px}.customer-order-date{font-size:11px;color:#697586;margin:0}
    .customer-order-overview{text-align:right;justify-items:end}.customer-order-status{font-size:10px;font-weight:700;background:#e8efff;color:#2459bd;padding:5px 8px;border-radius:20px}
    .customer-order-status.status-completed{background:#e5f7ec;color:#168044}.customer-order-status.status-cancelled{background:#ffebeb;color:#b42318}
    .customer-order-preview-total{font-size:13px;color:#14213d}
    .customer-order-content{padding:0 13px 13px;border-top:1px solid #e4eaf3}
    .customer-order-section-title{font-size:12px;font-weight:800;margin:12px 0 8px}
    .customer-order-items{display:grid;gap:9px;padding:4px 0 10px}
    .customer-order-item{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .customer-order-item-description{display:grid;gap:4px;min-width:0}
    .customer-order-item-name{font-size:12px;line-height:1.4}
    .customer-order-unit-price{font-size:11px;color:#697586}
    .customer-order-line-total{font-size:12px;white-space:nowrap}
    .customer-order-total,.customer-order-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #e4eaf3;font-size:12px}
    .customer-order-total strong{font-size:15px;color:#14213d}
    .customer-order-delivery,.customer-order-current{font-size:11px;color:#697586;margin:8px 0}
    .customer-order-history{margin-top:10px;font-size:12px;color:#475467}
    .customer-order-history summary{cursor:pointer;font-weight:700}.customer-order-history ol{padding-left:20px;display:grid;gap:7px}
    .customer-orders-empty,.customer-orders-loading,.customer-orders-error{font-size:13px;color:#697586;padding:10px}
  `;
  document.head.append(style);
  button.addEventListener('click',()=>{if(panel.hidden)load();else panel.hidden=true;});
})();
