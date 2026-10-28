(function(){
  'use strict';
  const config=window.UzCamBrandConfig,form=document.getElementById('catalogBrandForm'),dialog=document.getElementById('catalogBrandDialog');
  if(!form||!config)return;
  const host=document.getElementById('catalogBrandRows'),status=document.getElementById('catalogBrandsStatus'),editorStatus=document.getElementById('catalogBrandEditorStatus');
  let brands=[],editId=null,logo='',uploading=false;
  const iconLabels={camera:'Kamera',recorder:'DVR/NVR',network:'Tarmoq',router:'Router',home:'Aqlli uy',access:'Kirish nazorati',disk:'Qattiq disk',fiber:'Optika',cable:'Kabel',power:'Quvvat va UPS',alarm:'Signalizatsiya',chip:'Elektronika',all:'Yulduz'};
  for(const icon of config.iconNames)form.elements.icon.add(new Option(iconLabels[icon]||icon,icon));
  const split=value=>value.split(',').map(item=>item.trim()).filter(Boolean);
  function mark(item){
    const element=document.createElement('span');element.className='brand-manager-mark';element.innerHTML=config.iconSvg(item.icon);
    if(item.logo){const image=document.createElement('img');image.src=item.logo;image.alt='';image.onerror=()=>{element.innerHTML=config.iconSvg(item.icon);};element.replaceChildren(image);}
    return element;
  }
  function preview(){
    const host=document.getElementById('catalogBrandPreview'),label=document.createElement('b');label.textContent=form.elements.name.value||'Yangi bo‘lim';
    host.replaceChildren(mark({icon:form.elements.icon.value,logo}),label);
    document.getElementById('brandMatchField').hidden=form.elements.kind.value!=='brand';
    document.getElementById('brandKeywordField').hidden=form.elements.kind.value!=='type';
    form.elements.matchBrands.required=form.elements.kind.value==='brand';
    form.elements.keywords.required=form.elements.kind.value==='type';
  }
  async function request(url,method='GET',body){
    const response=await fetch(url,{method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Amal bajarilmadi');return result;
  }
  async function load(){
    status.textContent='Brendlar yuklanmoqda…';
    try{
      const result=await request('/api/admin/brands');brands=result.brands;host.replaceChildren();
      for(const item of brands){
        const row=document.createElement('div');row.className='brand-manager-row';
        const copy=document.createElement('div');copy.className='brand-manager-copy';
        const name=document.createElement('b'),detail=document.createElement('small');name.textContent=item.name;
        detail.textContent=(item.isActive?'Faol':'Yashirilgan')+' · Tartib: '+item.order+' · '+(item.kind==='brand'?item.matchBrands.join(', '):item.keywords.join(', '));copy.append(name,detail);
        const actions=document.createElement('div');actions.className='brand-manager-actions';
        const edit=document.createElement('button');edit.className='btn small';edit.type='button';edit.textContent='Tahrirlash';edit.onclick=()=>open(item);
        const toggle=document.createElement('button');toggle.className='btn small';toggle.type='button';toggle.textContent=item.isActive?'Yashirish':'Ko‘rsatish';
        toggle.onclick=async()=>{toggle.disabled=true;try{await request('/api/admin/brands/'+item.id,'PATCH',{isActive:!item.isActive});await load();}catch(error){status.textContent=error.message;toggle.disabled=false;}};
        const remove=document.createElement('button');remove.className='btn small danger';remove.type='button';remove.textContent='O‘chirish';
        remove.onclick=async()=>{if(!confirm('“'+item.name+'” bo‘limi o‘chirilsinmi? Mahsulotlar saqlanadi.'))return;remove.disabled=true;try{await request('/api/admin/brands/'+item.id,'DELETE');await load();}catch(error){status.textContent=error.message;remove.disabled=false;}};
        actions.append(edit,toggle,remove);row.append(mark(item),copy,actions);host.append(row);
      }
      status.textContent=brands.length+' ta bo‘lim · '+brands.filter(item=>item.isActive).length+' tasi katalogda ko‘rinadi';
    }catch(error){status.textContent=error.message;}
  }
  function open(item=null){
    form.reset();editId=item?.id||null;logo=item?.logo||'';
    form.elements.name.value=item?.name||'';form.elements.kind.value=item?.kind||'brand';
    form.elements.icon.value=item?.icon||'chip';form.elements.order.value=item?.order??(brands.length?Math.max(...brands.map(brand=>brand.order))+1:0);
    form.elements.matchBrands.value=item?.matchBrands.join(', ')||'';form.elements.keywords.value=item?.keywords.join(', ')||'';
    form.elements.isActive.checked=item?.isActive??true;editorStatus.textContent='';
    document.getElementById('catalogBrandEditorTitle').textContent=item?'Bo‘limni tahrirlash':'Bo‘lim qo‘shish';
    preview();dialog.showModal();
  }
  form.addEventListener('input',preview);form.elements.kind.addEventListener('change',preview);
  form.elements.logoFile.onchange=async()=>{
    const file=form.elements.logoFile.files[0];if(!file)return;
    const save=document.getElementById('saveCatalogBrand');save.disabled=true;uploading=true;editorStatus.textContent='Logo yuklanmoqda…';
    try{
      if(file.size>3*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('PNG, JPG yoki WEBP tanlang, 3 MB gacha.');
      const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Faylni o‘qib bo‘lmadi'));reader.readAsDataURL(file);});
      const result=await request('/api/admin/product-images','POST',{base64});logo=result.image;preview();editorStatus.textContent='Logo yuklandi. Saqlash tugmasini bosing.';
    }catch(error){editorStatus.textContent=error.message;}finally{save.disabled=false;uploading=false;form.elements.logoFile.value='';}
  };
  document.getElementById('clearCatalogBrandLogo').onclick=()=>{logo='';form.elements.logoFile.value='';preview();};
  for(const id of ['closeCatalogBrand','cancelCatalogBrand'])document.getElementById(id).onclick=()=>{if(!uploading)dialog.close();};
  dialog.addEventListener('cancel',event=>{if(uploading)event.preventDefault();});
  form.onsubmit=async event=>{
    event.preventDefault();if(uploading)return;
    const save=document.getElementById('saveCatalogBrand');save.disabled=true;editorStatus.textContent='Saqlanmoqda…';
    try{
      const body={name:form.elements.name.value,kind:form.elements.kind.value,icon:form.elements.icon.value,order:Number(form.elements.order.value),matchBrands:split(form.elements.matchBrands.value),keywords:split(form.elements.keywords.value),isActive:form.elements.isActive.checked,logo};
      await request('/api/admin/brands'+(editId?'/'+editId:''),editId?'PATCH':'POST',body);dialog.close();await load();
    }catch(error){editorStatus.textContent=error.message;}finally{save.disabled=false;}
  };
  document.getElementById('addCatalogBrand').onclick=()=>open();
  document.getElementById('reloadCatalogBrands').onclick=load;
  document.querySelector('[data-view="brands"]').addEventListener('click',()=>{if(document.getElementById('roleSelect').value==='super')void load();});
})();
