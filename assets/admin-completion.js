(()=>{
  const $=s=>document.querySelector(s);
  let user=null,payment=null;
  const viewPermissions={dashboard:'orders.read',orders:'orders.read',catalog:'catalog.read','worker-claims':'dispatch.manage',messages:'support.reply','home-content':'content.manage'};
  const can=key=>user?.role==='super_admin'||user?.permissions?.[key]===true;
  async function request(url,body,method=body===undefined?'GET':'PUT'){
    const response=await fetch(url,{method,cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Amal bajarilmadi');return result;
  }
  const tell=message=>typeof toast==='function'?toast(message):alert(message);
  function applyPermissions(){
    if(!user)return;
    document.querySelectorAll('.nav [data-view],[data-go]').forEach(el=>{const key=viewPermissions[el.dataset.view||el.dataset.go];if(key&&!can(key))el.hidden=true;});
    const selectors={'#addProduct':'catalog.write','#exportOrders':'reports.export','.save-order-status':'orders.manage','.confirm-real-payment':'payments.confirm','.reject-payment':'payments.confirm','#saveHomeContent':'content.manage'};
    for(const [selector,key] of Object.entries(selectors))document.querySelectorAll(selector).forEach(el=>{if(!can(key)){el.disabled=true;el.hidden=true;}});
  }
  async function loadSettings(){
    if(user?.role!=='super_admin')return;
    await Promise.allSettled([loadExchange(),loadPayment()]);
  }
  function renderExchange(data){
    for(const key of ['automatic','applyPrices','notifySuper'])$('#fx-'+key).checked=data.options[key];
    $('#fxRates').textContent=(data.state.rates||[]).map(r=>r.currency+' = '+r.rate.toLocaleString('uz-UZ')+' so‘m · '+r.effectiveDate).join(' | ')||'Hali kurs olinmagan';
    $('#fxStatus').textContent=data.state.error||('Oxirgi yangilanish: '+(data.state.lastSuccess?new Date(data.state.lastSuccess).toLocaleString('uz-UZ'):'hali yo‘q'));
  }
  async function loadExchange(){try{renderExchange(await request('/api/settings/exchange'));}catch(e){$('#fxStatus').textContent=e.message}}
  async function loadPayment(){try{payment=await request('/api/settings/payment');$('#paymentCard').value=payment.cardNumber;$('#paymentHolder').value=payment.cardHolder;$('#paymentQrPreview').src=payment.qrImage;$('#paymentQrPreview').hidden=!payment.qrImage;$('#paymentNoQr').checked=!payment.qrImage;$('#paymentStatus').textContent='Serverdagi amaldagi rekvizitlar';}catch(e){$('#paymentStatus').textContent=e.message}}
  async function editPermissions(id){
    try{
      const data=await request('/api/admin/permissions/'+id),dialog=$('#permissionsDialog'),list=$('#permissionFields');list.replaceChildren();dialog.dataset.id=id;
      for(const [key,label] of Object.entries(data.labels)){const row=document.createElement('label');row.className='check';const input=document.createElement('input');input.type='checkbox';input.name=key;input.checked=data.permissions[key];row.append(input,document.createTextNode(label));list.append(row)}
      $('#permissionStatus').textContent='Telegram ID: '+id;dialog.showModal();
    }catch(e){tell(e.message)}
  }
  window.UzCamAdminCompletion={
    session(value){user=value;applyPermissions();if(!can('orders.read')&&user.role==='admin'){const first=Object.keys(viewPermissions).find(v=>can(viewPermissions[v]));if(first)go(first);else{$('#dashboardRecentOrders').textContent='Sizga hali bo‘lim ruxsati berilmagan. Super Admin bilan bog‘laning.';document.querySelectorAll('.stat strong').forEach(el=>el.textContent='—');}}},
    canView(name){return !user||!viewPermissions[name]||can(viewPermissions[name]);},
    open(name){applyPermissions();if(name==='settings')void loadSettings();},
    applyPermissions,
    disputeCard(card,job){
      if(job.service_state!=='disputed'||!can('dispatch.manage'))return;
      const form=document.createElement('form'),label=document.createElement('label'),note=document.createElement('textarea'),button=document.createElement('button'),status=document.createElement('p');
      label.textContent='Murojaat qanday hal qilindi?';note.required=true;note.maxLength=500;note.rows=3;note.style.cssText='width:100%;margin:8px 0';label.append(note);button.className='btn primary';button.textContent='Mijozga qayta tasdiqlash uchun yuborish';status.setAttribute('role','status');form.append(label,button,status);
      form.onsubmit=async e=>{e.preventDefault();button.disabled=true;try{await request('/api/admin/service-jobs/'+job.id+'/resolve',{note:note.value},'POST');tell('Mijozga qayta tasdiqlash yuborilmoqda');await renderClaimMonitor();}catch(error){status.textContent=error.message;button.disabled=false}};card.append(form);
    }
  };
  $('#saveRate').onclick=async e=>{const button=e.currentTarget;button.disabled=true;$('#fxStatus').textContent='CBU kursi tekshirilmoqda…';try{renderExchange(await request('/api/settings/exchange/refresh',{},'POST'));}catch(error){await loadExchange();$('#fxStatus').textContent=error.message;}finally{button.disabled=false}};
  $('#fxForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const data=Object.fromEntries(['automatic','applyPrices','notifySuper'].map(key=>[key,$('#fx-'+key).checked]));renderExchange(await request('/api/settings/exchange',data));tell('Kurs sozlamalari saqlandi');}catch(error){$('#fxStatus').textContent=error.message}finally{button.disabled=false}};
  $('#paymentSettingsForm').onsubmit=async e=>{
    e.preventDefault();const button=e.submitter;button.disabled=true;$('#paymentStatus').textContent='Saqlanmoqda…';
    try{
      if(!payment)throw Error('Avval amaldagi rekvizitlarni yuklang');
      const body={cardNumber:$('#paymentCard').value,cardHolder:$('#paymentHolder').value,qrImage:$('#paymentNoQr').checked?'':payment.qrImage},file=$('#paymentQrFile').files[0];
      if(file&&!$('#paymentNoQr').checked){if(file.size>3*1024*1024)throw Error('QR rasm 3 MB dan oshmasin');body.qrBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Rasm o‘qilmadi'));reader.readAsDataURL(file)});}
      payment=await request('/api/settings/payment',body);$('#paymentQrFile').value='';await loadPayment();$('#paymentStatus').textContent='Saqlandi. Yangi to‘lov sahifalarida shu rekvizitlar ko‘rinadi.';tell('To‘lov rekvizitlari saqlandi');
    }catch(error){$('#paymentStatus').textContent=error.message}finally{button.disabled=false}
  };
  $('#paymentQrFile').onchange=()=>{if($('#paymentQrFile').files.length)$('#paymentNoQr').checked=false;};
  $('#reloadPaymentSettings').onclick=loadPayment;
  $('#exportOrders').onclick=async e=>{
    const button=e.currentTarget;button.disabled=true;
    try{
      const params=new URLSearchParams();for(const [key,selector] of [['status','#orderStatusFilter'],['delivery','#orderDeliveryFilter'],['q','#orderSearch'],['from','#reportFrom'],['to','#reportTo']]){const value=$(selector)?.value;if(value)params.set(key,value);}
      const response=await fetch('/api/admin/orders/export?'+params,{cache:'no-store'});if(!response.ok){const data=await response.json();throw Error(data.error||'Hisobot olinmadi')}
      const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='uzcam-buyurtmalar.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);tell('Hisobot yuklandi');
    }catch(error){tell(error.message)}finally{button.disabled=false}
  };
  document.addEventListener('click',e=>{const button=e.target.closest('[data-admin-permissions]');if(button)void editPermissions(button.dataset.adminPermissions);});
  $('#closePermissions').onclick=()=>$('#permissionsDialog').close();
  $('#permissionsForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const permissions=Object.fromEntries([...$('#permissionFields').querySelectorAll('input')].map(input=>[input.name,input.checked]));await request('/api/admin/permissions/'+$('#permissionsDialog').dataset.id,{permissions});$('#permissionsDialog').close();tell('Admin ruxsatlari serverda saqlandi');}catch(error){$('#permissionStatus').textContent=error.message}finally{button.disabled=false}};
})();
