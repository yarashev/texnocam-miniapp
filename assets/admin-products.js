(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form=$('productForm'), dialog=$('productDialog');
  let page=1, pageCount=1, config={canManageCosts:false}, current=null, selectedFile=null, previewUrl=null, request=null, searchTimer=null;
  $('addProduct').disabled=true;
  const money=value=>new Intl.NumberFormat('uz-UZ').format(Number(value)||0)+' so‘m';
  async function api(url,options={}) { const response=await fetch(url,{cache:'no-store',...options}); const data=await response.json(); if(!response.ok)throw new Error(data.error||'Amalni bajarib bo‘lmadi');return data; }
  const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  function node(tag,text,cls) {const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;}
  function fillChoices(select,values,label){const previous=select.value;select.replaceChildren(new Option(label,''),...values.map(value=>new Option(value,value)));select.value=previous;}
  async function loadProducts(){
    if(request)request.abort();request=new AbortController();$('managedProducts').setAttribute('aria-busy','true');
    const params=new URLSearchParams({page:String(page),search:$('productSearch').value,brand:$('productBrandFilter').value,category:$('productCategoryFilter').value,state:$('productStateFilter').value});
    try {
      const result=await api('/api/admin/products?'+params,{signal:request.signal});config=result;$('addProduct').disabled=false;page=result.page;pageCount=Math.max(1,Math.ceil(result.total/result.pageSize));
      fillChoices($('productBrandFilter'),result.brands,'Barcha brendlar');fillChoices($('productCategoryFilter'),result.categories,'Barcha kategoriyalar');
      for(const [id,values] of [['managedProductBrands',result.brands],['managedProductCategories',result.categories]])$(id).replaceChildren(...values.map(value=>new Option(value,value)));
      $('managedProductCount').textContent=result.total+' ta mahsulot';$('productPageLabel').textContent=page+' / '+pageCount;$('productPagePrev').disabled=page<=1;$('productPageNext').disabled=page>=pageCount;
      const list=$('managedProducts');list.replaceChildren();
      for(const product of result.products){
        const row=node('article',undefined,'mp-row');const image=node('img',undefined,'mp-image');image.alt=product.name;image.loading='lazy';if(product.image)image.src=product.image;else image.hidden=true;image.onerror=()=>{image.hidden=true};
        const info=node('div',undefined,'mp-info');info.append(node('b',product.name),node('small','Model: '+product.model),node('small',product.brand+' · '+(product.category||'Kategoriya yo‘q')));
        const price=node('div',undefined,'mp-price');price.append(node('strong',money(product.price_uzs)),node('span',product.deleted_at?'O‘chirilgan':product.is_active?'Faol':'Yashirilgan','pill '+(product.deleted_at?'red':product.is_active?'green':'amber')));
        const actions=node('div',undefined,'mp-actions');
        const action=(label,handler,danger=false)=>{const button=node('button',label,'btn small'+(danger?' danger':''));button.type='button';button.onclick=async()=>{button.disabled=true;try{await handler()}catch(error){toast(error.message)}finally{button.disabled=false}};actions.append(button)};
        if(product.deleted_at)action('Tiklash',()=>stateProduct(product,{restore:true}));
        else {action('Tahrirlash',()=>openProduct(product.id));action(product.is_active?'Yashirish':'Ko‘rsatish',()=>stateProduct(product,{isActive:!product.is_active}));action('O‘chirish',async()=>{if(!confirm('“'+product.name+'” mahsulotini o‘chirasizmi? Uni O‘chirilgan bo‘limidan tiklash mumkin.'))return;await api('/api/admin/products/'+product.id,{method:'DELETE'});toast('Mahsulot o‘chirildi');await loadProducts()},true)}
        row.append(image,info,price,actions);list.append(row);
      }
      if(!result.products.length)list.append(node('div','Bu filtr bo‘yicha mahsulot topilmadi.','mp-empty'));
    }catch(error){if(error.name!=='AbortError'){$('managedProducts').replaceChildren(node('div',error.message,'mp-empty'));$('managedProductCount').textContent='Yuklash bajarilmadi'}}finally{$('managedProducts').setAttribute('aria-busy','false')}
  }
  async function stateProduct(product,body){await api('/api/admin/products/'+product.id,json('PATCH',body));toast(body.restore?'Mahsulot yashirin holatda tiklandi':'Mahsulot holati saqlandi');await loadProducts()}
  function releasePreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;selectedFile=null;$('productImage').value=''}
  function showImage(value){const image=$('productImagePreview');image.hidden=!value;$('uploadIcon').hidden=!!value;if(value)image.src=value;else image.removeAttribute('src')}
  function setPricing(){
    const can=config.canManageCosts,source=can&&$('productPriceMode').value==='source';
    $('productPrivatePricing').hidden=!can;$('sourcePriceFields').hidden=!source;$('sourcePrice').required=source;$('productRate').required=source;$('productSalePrice').readOnly=source||(!can&&!!current);
    $('productPriceNotice').textContent=!can&&current?'Amaldagi narxni Super Admin yoki kurs yangilash jarayoni o‘zgartiradi.':'';
    $('marginRuleNote').textContent=can?'Manba narxi × kurs + '+config.pricing.markupPercent+'% ustama. Faqat Super Admin ko‘radi.':'';
    if(source){const value=Math.round(Number($('sourcePrice').value)*Number($('productRate').value)*(1+config.pricing.markupPercent/100));$('productSalePrice').value=value>0?value:''}
    $('salePricePreview').textContent=$('productSalePrice').value?money($('productSalePrice').value):'Narx kiriting';$('priceExplain').textContent=source?'Manba narxi va kurs asosida hisoblanadi':'Mijozga ko‘rinadigan narx';
  }
  async function openProduct(id=null){
    $('productFormStatus').textContent='';releasePreview();form.reset();current=id?(await api('/api/admin/products/'+id)).product:null;
    $('productDialogTitle').textContent=current?'Mahsulotni tahrirlash':'Mahsulot qo‘shish';
    for(const field of ['name','model','brand','category','description'])form.elements[field].value=current?.[field]||'';
    $('productImageUrl').value=current?.image||'';showImage(current?.image||'');$('productIsActive').checked=current?!!current.is_active:true;$('productSalePrice').value=current?.price_uzs||'';
    $('productPriceMode').value=config.canManageCosts&&current?.source_price!=null?'source':'sale';$('sourcePrice').value=current?.source_price??'';$('sourceCurrency').value=current?.source_currency||'USD';$('productRate').value=current?.rate_used??config.pricing?.rates?.USD??'';
    setPricing();dialog.showModal();
  }
  $('addProduct').onclick=()=>openProduct().catch(error=>toast(error.message));$('closeProduct').onclick=()=>dialog.close();$('cancelProduct').onclick=()=>dialog.close();dialog.addEventListener('close',releasePreview);
  $('productImage').onchange=()=>{const file=$('productImage').files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>3*1024*1024){$('productFormStatus').textContent='JPG, PNG yoki WEBP rasm tanlang. Hajmi 3 MB dan oshmasin.';$('productImage').value='';return}if(previewUrl)URL.revokeObjectURL(previewUrl);selectedFile=file;previewUrl=URL.createObjectURL(file);showImage(previewUrl);$('productFormStatus').textContent=''};
  $('productImageUrl').oninput=()=>{if(!selectedFile)showImage($('productImageUrl').value.trim())};$('productImagePreview').onerror=()=>{$('productImagePreview').hidden=true};
  for(const id of ['sourcePrice','productRate','productSalePrice'])$(id).oninput=setPricing;
  $('productPriceMode').onchange=setPricing;$('sourceCurrency').onchange=()=>{$('productRate').value=$('sourceCurrency').value==='UZS'?1:config.pricing?.rates?.[$('sourceCurrency').value]||'';setPricing()};
  const fileBase64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Rasmni o‘qib bo‘lmadi'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file)});
  form.onsubmit=async event=>{
    event.preventDefault();const save=$('saveManagedProduct');save.disabled=true;$('productFormStatus').textContent='Saqlanmoqda…';
    try {
      let image=$('productImageUrl').value.trim();if(selectedFile)image=(await api('/api/admin/product-images',json('POST',{base64:await fileBase64(selectedFile)}))).image;
      const body={};for(const field of ['name','model','brand','category','description'])body[field]=form.elements[field].value.trim();body.image=image;body.isActive=$('productIsActive').checked;
      if(config.canManageCosts){body.priceMode=$('productPriceMode').value;if(body.priceMode==='source'){body.sourcePrice=Number($('sourcePrice').value);body.currency=$('sourceCurrency').value;body.rate=Number($('productRate').value)}else body.salePrice=Number($('productSalePrice').value)}else if(!current)body.salePrice=Number($('productSalePrice').value);
      await api(current?'/api/admin/products/'+current.id:'/api/admin/products',json(current?'PUT':'POST',body));dialog.close();page=1;await loadProducts();toast('Mahsulot saqlandi. Mijoz katalogida yangilanadi.');
    }catch(error){$('productFormStatus').textContent=error.message}finally{save.disabled=false}
  };
  $('productSearch').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=1;loadProducts()},300)};
  for(const id of ['productBrandFilter','productCategoryFilter','productStateFilter'])$(id).onchange=()=>{page=1;loadProducts()};$('refreshManagedProducts').onclick=()=>loadProducts();$('productPagePrev').onclick=()=>{page--;loadProducts()};$('productPageNext').onclick=()=>{page++;loadProducts()};
  loadProducts();
})();
