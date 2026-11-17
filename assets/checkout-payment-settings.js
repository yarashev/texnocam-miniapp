window.UzCamCheckoutPayment=(()=>{
  async function load(host){
    const button=host.querySelector('#paymentSubmitted'),frame=host.querySelector('.paynet-frame');if(!button||!frame)return;
    button.disabled=true;frame.replaceChildren();
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent='To‘lov rekvizitlari yuklanmoqda…';frame.append(status);
    try{
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
      if(button.isConnected)button.disabled=false;
    }catch(error){
      if(!button.isConnected)return;status.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.className='secondary-action';retry.textContent='Qayta yuklash';retry.onclick=()=>load(host);frame.replaceChildren(status,retry);button.disabled=true;
    }
  }
  return {load};
})();
