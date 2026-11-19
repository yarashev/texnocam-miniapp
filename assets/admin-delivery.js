(()=>{
 const host=document.querySelector('#view-settings .rate-card')||document.querySelector('#view-settings');if(!host)return;
 const panel=document.createElement('section');panel.className='panel';panel.innerHTML='<div class="panel-head"><h2>Xabarlar yuborilishi</h2><button class="btn" type="button" id="refreshDeliveryStatus">Yangilash</button></div><p id="deliveryCounts" role="status">Yuklanmoqda…</p><p id="deliveryRunnerStatus" class="muted"></p><p class="muted">Takliflar, mijoz xabarlari va tugma yangilanishlari server ishlayotgan paytda qayta ishlanadi. Yuborish javobi uzilgan ayrim holatlarda qayta urinish takroriy xabarga sabab bo‘lishi mumkin.</p><div id="failedDeliveryList" class="quick-list"></div>';host.append(panel);
 const counts=panel.querySelector('#deliveryCounts'),status=panel.querySelector('#deliveryRunnerStatus'),list=panel.querySelector('#failedDeliveryList');
 async function load(){
  try{
   const r=await fetch('/api/admin/delivery-status',{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Xabarlar holati olinmadi');
   const n=data.counts;counts.textContent='Kutilmoqda: '+n.pending+' · Yuborilmoqda: '+n.sending+' · Yuborilgan: '+n.sent+' · Xato: '+n.failed+' · Eskirgan: '+n.superseded;
   status.textContent='Oxirgi tekshiruv: '+(data.runner?.lastFinishedAt?new Date(data.runner.lastFinishedAt).toLocaleString('uz-UZ'):'hali yo‘q');
   list.replaceChildren();for(const row of data.failed){const item=document.createElement('div');item.className='quick-row';const info=document.createElement('div'),title=document.createElement('b'),detail=document.createElement('small'),button=document.createElement('button');title.textContent=row.title;detail.textContent='Urinishlar: '+row.attempts+' · '+(row.last_error||'Yuborilmadi');info.append(title,detail);button.className='btn small';button.type='button';button.textContent='Qayta yuborish';button.onclick=async()=>{button.disabled=true;try{const r=await fetch('/api/admin/delivery-status/'+row.id+'/retry',{method:'POST'}),value=await r.json();if(!r.ok)throw Error(value.error||'Qayta yuborilmadi');await load();}catch(error){status.textContent=error.message;button.disabled=false}};item.append(info,button);list.append(item)}
  }catch(error){counts.textContent=error.message}
 }
 panel.querySelector('#refreshDeliveryStatus').onclick=load;
 const previous=window.UzCamAdminCompletion?.open;if(previous)window.UzCamAdminCompletion.open=function(name){previous.call(this,name);if(name==='settings')void load()};
})();
