window.UzCamCheckoutPayment=(()=>{
  let attempt=null;
  const storageKey='uzcam-checkout-attempt-v1';
  async function checkoutKey(order,initData){
    let owner='';try{owner=String(JSON.parse(new URLSearchParams(initData).get('user')||'{}').id||'')}catch{}
    const canonical={owner,items:order.items.map(x=>({id:Number(x.id),quantity:Number(x.quantity)})).sort((a,b)=>a.id-b.id),deliveryMethod:order.deliveryMethod==='courier'?'address':order.deliveryMethod,phone:String(order.phone||'').trim(),address:String(order.address||'').trim(),recipientName:String(order.recipientName||'').trim(),servicePreference:order.servicePreference};
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical))),fingerprint=[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
    try{if(!attempt)attempt=JSON.parse(localStorage.getItem(storageKey)||'null')}catch{}
    if(attempt?.fingerprint!==fingerprint){attempt={fingerprint,key:crypto.randomUUID()};try{localStorage.setItem(storageKey,JSON.stringify(attempt))}catch{}}
    return attempt.key;
  }
  function forget(key){if(attempt?.key!==key)return;attempt=null;try{if(JSON.parse(localStorage.getItem(storageKey)||'null')?.key===key)localStorage.removeItem(storageKey)}catch{}}
  async function load(host,order){
    const button=host.querySelector('#paymentSubmitted'),frame=host.querySelector('.paynet-frame');if(!button||!frame)return;
    button.disabled=true;frame.replaceChildren();
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent='To‘lov rekvizitlari yuklanmoqda…';frame.append(status);
    try{
      const initData=window.Telegram?.WebApp?.initData;
      if(!initData)throw Error('To‘lov uchun mini ilovani Telegram ichidan oching.');
      if(!order)throw Error('Yetkazish ma’lumotlarini qayta tasdiqlang.');
      order.checkoutKey=await checkoutKey(order,initData);
      const preparedResponse=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData,idempotencyKey:order.checkoutKey,order})}),prepared=await preparedResponse.json();
      if(!preparedResponse.ok)throw Error(prepared.error||'To‘lov summasini tasdiqlab bo‘lmadi');
      order.total=prepared.total;
      if(!button.isConnected)return;
      const money=Number(prepared.total).toLocaleString('uz-UZ')+' so‘m';
      host.querySelectorAll('[data-checkout-total]').forEach(el=>el.textContent=money);
      const note=host.querySelector('#checkoutAmountNotice');if(note)note.textContent='Buyurtma '+prepared.orderNumber+'. To‘lov summasi: '+money+'. Bu summa serverda saqlandi va katalog narxi o‘zgarsa ham o‘zgarmaydi.';
      if(prepared.submitted){
        if(note)note.textContent='Buyurtma '+prepared.orderNumber+' avval yuborilgan. Summa: '+money+'. Qayta to‘lov qilmang.';
        const hint=host.querySelector('.payment-hint');if(hint)hint.textContent='Saqlangan buyurtma natijasini pastdagi tugma orqali ko‘ring.';
        status.textContent=prepared.paymentStatus==='confirmed'?'To‘lov tasdiqlangan.':'Buyurtma saqlangan. To‘lov holatini admin tekshiradi.';
        frame.replaceChildren(status);button.textContent='Saqlangan buyurtmani ko‘rish';button.dataset.checkoutReady='1';button.disabled=false;return;
      }
      const response=await fetch('/api/payment-settings',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'Rekvizitlar olinmadi');
      if(!button.isConnected)return;
      frame.replaceChildren();let valid=false;
      if(/^\d{16}$/.test(data.cardNumber||'')){const card=document.createElement('p');card.textContent='Karta: '+data.cardNumber.replace(/(\d{4})(?=\d)/g,'$1 ')+'\n'+(data.cardHolder||'');card.style.whiteSpace='pre-line';frame.append(card);valid=true;}
      if(data.qrImage==='/assets/paynet-payment-qr.png'||/^\/api\/payment-qr\/[a-f0-9-]{36}$/.test(data.qrImage||'')){
        const image=document.createElement('img');image.alt='To‘lov uchun QR kod';image.src=data.qrImage;
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('QR yuklanmadi. To‘lov sahifasini qayta oching.'));frame.append(image)}).catch(error=>{image.remove();if(!valid)throw error;const p=document.createElement('p');p.textContent=error.message;frame.append(p)});
        valid=valid||image.isConnected;
      }
      if(!valid)throw Error('To‘lov rekvizitlari sozlanmagan. Admin bilan bog‘laning.');
      if(button.isConnected){button.dataset.checkoutReady='1';button.disabled=false;}
    }catch(error){
      if(!button.isConnected)return;status.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.className='secondary-action';retry.textContent='Qayta yuklash';retry.onclick=()=>load(host,order);frame.replaceChildren(status,retry);button.disabled=true;
    }
  }
  return {load,forget};
})();
