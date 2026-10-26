(function () {
  const $=id=>document.getElementById(id),tools=$('catalogTools');
  if(!tools)return;
  const brandSelect=$('brandFilter'),priceSelect=$('priceFilter');
  const panels={brand:$('brandPicker'),price:$('pricePicker')};
  const triggers={brand:$('brandPickerButton'),price:$('pricePickerButton')};
  let opened=null,lastBrandState='';
  const priceChoices=[
    {value:'all',title:'Arzonidan',description:'Barcha mahsulotlar arzon narxdan',symbol:'↓'},
    {value:'cheap',title:'Arzon',description:'Narxi past mahsulotlar',symbol:'₋'},
    {value:'medium',title:'O‘rtacha',description:'O‘rtacha narxdagi mahsulotlar',symbol:'≈'},
    {value:'expensive',title:'Qimmat',description:'Qimmat mahsulotlar yuqorida',symbol:'↑'}
  ];
  function close(returnFocus=false) {
    const previous=opened;
    for(const key of Object.keys(panels)){panels[key].hidden=true;triggers[key].setAttribute('aria-expanded','false');}
    opened=null;
    if(returnFocus&&previous)triggers[previous].focus();
  }
  function positionPicker() {
    if(!opened)return;
    const rect=tools.getBoundingClientRect(),below=innerHeight-rect.bottom-16,above=rect.top-16;
    const upwards=below<300&&above>below,panel=panels[opened];
    panel.style.top=upwards?'auto':'calc(100% + 8px)';panel.style.bottom=upwards?'calc(100% + 8px)':'auto';
    panel.style.maxHeight=Math.max(140,Math.min(430,upwards?above:below))+'px';panel.style.overflowY='auto';
  }
  function open(key) {
    if(opened===key){close(true);return;}
    close();opened=key;panels[key].hidden=false;triggers[key].setAttribute('aria-expanded','true');
    if(key==='brand'){$('brandPickerSearch').value='';drawBrands();$('brandPickerSearch').focus();}
    else $('pricePickerOptions').querySelector('[aria-checked="true"]').focus();
    positionPicker();
  }
  function chooseBrand(value) {brandSelect.value=value;close(true);brandSelect.dispatchEvent(new Event('change',{bubbles:true}));}
  function drawBrands() {
    const host=$('brandPickerOptions'),query=$('brandPickerSearch').value.trim().toLocaleLowerCase('uz');host.replaceChildren();
    const options=[...brandSelect.options].filter(option=>!query||option.value.toLocaleLowerCase('uz').includes(query)||option.value==='Barcha brendlar');
    for(const option of options) {
      const button=document.createElement('button');button.type='button';button.className='brand-choice'+(option.value==='Barcha brendlar'?' all-brands':'');
      button.setAttribute('aria-pressed',String(option.value===brandSelect.value));button.dataset.brand=option.value;
      const mark=document.createElement('span');mark.textContent=option.value==='Barcha brendlar'?'▦':option.value.replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase();mark.setAttribute('aria-hidden','true');
      const label=document.createElement('b');label.textContent=option.textContent;button.append(mark,label);button.onclick=()=>chooseBrand(option.value);host.append(button);
    }
    if(options.length===1&&query){const empty=document.createElement('div');empty.className='picker-empty';empty.textContent='Brend topilmadi';host.append(empty);}
  }
  for(const choice of priceChoices) {
    const button=document.createElement('button');button.type='button';button.className='price-choice';button.setAttribute('role','radio');button.dataset.price=choice.value;
    const symbol=document.createElement('span');symbol.className='price-symbol';symbol.textContent=choice.symbol;symbol.setAttribute('aria-hidden','true');
    const copy=document.createElement('span');copy.className='price-choice-copy';const title=document.createElement('b'),description=document.createElement('small');title.textContent=choice.title;description.textContent=choice.description;copy.append(title,description);
    const check=document.createElement('span');check.className='price-check';check.setAttribute('aria-hidden','true');button.append(symbol,copy,check);
    button.onclick=()=>{priceSelect.value=choice.value;close(true);priceSelect.dispatchEvent(new Event('change',{bubbles:true}));};$('pricePickerOptions').append(button);
  }
  function refresh() {
    const brand=brandSelect.value||'Barcha brendlar',price=priceSelect.value||'all';
    triggers.brand.classList.toggle('is-filtered',brand!=='Barcha brendlar');triggers.brand.title='Brend: '+brand;
    triggers.price.classList.toggle('is-filtered',price!=='all');triggers.price.title='Narx: '+(priceChoices.find(item=>item.value===price)?.title||'Arzonidan');
    $('activeFilterLabel').textContent=brand+' · '+(priceChoices.find(item=>item.value===price)?.title||'Arzonidan');
    $('pricePickerOptions').querySelectorAll('button').forEach(button=>{const selected=button.dataset.price===price;button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;});
    const stamp=JSON.stringify([[...brandSelect.options].map(option=>option.value),brand]);
    if(stamp!==lastBrandState){lastBrandState=stamp;drawBrands();}
  }
  function setPhone(value) {
    const phone=String(value??'+998508554187').replace(/[ ()-]/g,'');
    const link=$('catalogPhone');
    if(!/^\+[1-9]\d{6,14}$/.test(phone)){link.hidden=true;link.removeAttribute('href');return;}
    const formatted=/^\+998\d{9}$/.test(phone)?phone.replace(/^(\+998)(\d{2})(\d{3})(\d{2})(\d{2})$/,'$1 $2 $3 $4 $5'):phone;
    link.hidden=false;link.href='tel:'+phone;$('catalogPhoneText').textContent=formatted;link.setAttribute('aria-label','UzCam bilan bog‘lanish: '+formatted);
  }
  for(const key of Object.keys(triggers))triggers[key].onclick=()=>open(key);
  tools.querySelectorAll('[data-close-picker]').forEach(button=>button.onclick=()=>close(true));
  $('brandPickerSearch').addEventListener('input',drawBrands);
  document.addEventListener('pointerdown',event=>{if(opened&&!tools.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened){event.preventDefault();close(true);}});
  $('pricePickerOptions').addEventListener('keydown',event=>{
    if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const buttons=[...$('pricePickerOptions').children],current=buttons.indexOf(document.activeElement),direction=['ArrowDown','ArrowRight'].includes(event.key)?1:-1;
    const index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+direction+buttons.length)%buttons.length;
    priceSelect.value=buttons[index].dataset.price;priceSelect.dispatchEvent(new Event('change',{bubbles:true}));buttons[index].focus();
  });
  window.addEventListener('resize',positionPicker);
  window.UzCamCatalogControls={refresh,setPhone,close};refresh();setPhone(typeof homeContent==='undefined'?undefined:homeContent.contactPhone);
})();
