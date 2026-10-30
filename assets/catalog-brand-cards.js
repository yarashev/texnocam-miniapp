(function(){
  'use strict';
  const state=window.UzCamCatalogState,config=window.UzCamBrandConfig;
  if(!state||!config)return;
  const host=document.getElementById('cats'),app=document.querySelector('.app');
  let sections=[],selected=null,loadError='';
  function makeIcon(icon,logo){
    const holder=document.createElement('span');holder.className='catalog-card-icon';
    holder.innerHTML=config.iconSvg(icon);
    if(logo){
      const image=document.createElement('img');image.src=logo;image.alt='';image.loading='lazy';
      image.onerror=()=>{holder.innerHTML=config.iconSvg(icon);};
      holder.replaceChildren(image);
    }
    return holder;
  }
  function decorate(button,name,icon,count,logo=''){
    const label=document.createElement('span');label.className='catalog-card-name';label.textContent=name;
    const total=document.createElement('span');total.className='catalog-card-count';total.textContent=count+' ta mahsulot';
    button.replaceChildren(makeIcon(icon,logo),label,total);
  }
  function label(text,detail){
    const heading=document.createElement('div');heading.className='catalog-grid-label';
    const title=document.createElement('span'),small=document.createElement('small');title.textContent=text;small.textContent=detail;
    heading.append(title,small);return heading;
  }
  function showProducts(section,{fromBack=false}={}){
    if(!fromBack)window.UzCamTelegramBack?.push(()=>window.UzCamCatalogNavigation?.showCategories(null,{fromBack:true}));
    selected=section;state.activeCategory='Barchasi';state.activeBrand='Barcha brendlar';state.visibleLimit=40;
    document.getElementById('brandFilter').value='Barcha brendlar';
    document.getElementById('search').value='';
    document.getElementById('priceFilter').value='all';document.getElementById('priceFilter').dispatchEvent(new Event('change'));
    app.classList.remove('catalog-category-mode');app.classList.add('catalog-products-mode');
    document.getElementById('categoryHeading').hidden=true;host.hidden=true;
    document.getElementById('backToCategories').hidden=false;
    document.getElementById('catalogTitle').textContent=section.name;
    state.renderProducts();history.replaceState(null,'',location.pathname+'#catalog-section-'+encodeURIComponent(section.id));
    window.scrollTo(0,0);
  }
  const original=state.renderCats;
  state.renderCats=function(){
    if(app.classList.contains('catalog-category-mode'))selected=null;
    original();
    if(!app.classList.contains('catalog-category-mode'))return;
    document.querySelector('#categoryHeading h2').textContent='Katalog';
    const categories=[...host.querySelectorAll('.cat')];
    host.replaceChildren(label('Brendlar va bo‘limlar',sections.length+' ta bo‘lim'));
    for(const section of sections){
      const button=document.createElement('button');button.type='button';button.className='cat brand-section-card';
      button.dataset.brandSection=section.id;
      decorate(button,section.name,section.icon,state.items.filter(item=>config.matchesSection(item,section)).length,section.logo);
      button.onclick=()=>showProducts(section);host.append(button);
    }
    if(loadError){const status=document.createElement('div');status.className='catalog-load-status';status.textContent=loadError;status.setAttribute('role','status');host.append(status);}
    host.append(label('Mahsulot turlari','Kategoriya bo‘yicha tanlang'));
    for(const button of categories){
      const name=button.dataset.cat,count=state.items.filter(item=>name==='Barchasi'||item.cat===name).length;
      decorate(button,name,config.categoryIcon(name),count);
      const click=button.onclick;button.onclick=event=>{selected=null;click.call(button,event);};
      host.append(button);
    }
  };
  window.UzCamBrandCatalog={matches:product=>config.matchesSection(product,selected),clear:()=>{selected=null;}};
  document.querySelectorAll('.bottom-nav .nav-item').forEach(button=>button.addEventListener('click',()=>{selected=null;state.renderProducts();}));
  // Promo navigation sets its own brand/category; discard the previous section first.
  document.getElementById('promoTrack')?.addEventListener('click',()=>{selected=null;},{capture:true});
  async function load(){
    try{
      const response=await fetch('/api/catalog-brands',{cache:'no-store'}),result=await response.json();
      if(!response.ok||!Array.isArray(result.brands))throw new Error('Brendlarni yuklab bo‘lmadi. Sahifani yangilang.');
      sections=result.brands;loadError='';
    }catch{loadError='Brendlarni yuklab bo‘lmadi. Sahifani yangilang.';}
    state.renderCats();
    const sectionId=location.hash.startsWith('#catalog-section-')?location.hash.slice(17):null;
    const section=sections.find(item=>item.id===sectionId);if(section)showProducts(section);
  }
  state.renderCats();
  if(location.hash==='#catalog-categories')document.getElementById('backToCategories').click();
  void load();
})();
