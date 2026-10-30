// Shared catalog sections and original, theme-colored SVG icons.
(function(root){
  'use strict';
  const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9а-яёўқғҳ]+/g,'');
  const sections=[
    ['hikvision','Hikvision','camera',['Hikvision']],
    ['hilook','HiLook','camera',['HiLook']],
    ['dahua','Dahua','camera',['Dahua']],
    ['tplink','TP-Link','router',['TP-Link','TpLink']],
    ['tapo','Tapo','home',['Tapo']],
    ['mercusys','Mercusys','router',['Mercusys']],
    ['witek','Wi-Tek','network',['Wi-Tek','WiTek']],
    ['kanihad','KANIHAD','network',['KANIHAD']],
    ['zkteco','ZKTeco','access',['ZKTeco']],
    ['ubiquiti-mikrotik','Ubiquiti va MikroTik','network',['Ubiquiti','MikroTik','Ubiquiti and Mikrotik']],
    ['hard-drives','Qattiq disklar','disk',[],['hdd','hard disk','qattiq disk','жестк','жёстк','western digital','seagate']],
    ['optics','Optika','fiber',[],['optik','optical','fiber','sfp','оптик']],
    ['cable','Kabel','cable',[],['kabel','cable','utp','ftp','кабел']]
  ].map(([id,name,icon,matchBrands,keywords=[]],order)=>({id,name,icon,matchBrands,keywords,kind:matchBrands.length?'brand':'type',logo:'',order,isActive:true}));
  const paths={
    camera:'<path d="M8 10h6l3-4h14l3 4h6v28H8z"/><circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="4"/><path d="M12 14h4"/>',
    recorder:'<rect x="5" y="14" width="38" height="22" rx="5"/><path d="M10 21h20M10 26h20M10 31h10"/><circle cx="37" cy="25" r="1"/>',
    network:'<rect x="4" y="17" width="40" height="19" rx="4"/><path d="M9 23h5v6H9zm9 0h5v6h-5zm9 0h5v6h-5zM12 17V9m24 8V9"/><circle cx="38" cy="26" r="1"/>',
    router:'<rect x="8" y="25" width="32" height="14" rx="5"/><path d="M12 25V13m24 12V13M17 16a10 10 0 0 1 14 0M21 20a4 4 0 0 1 6 0"/><circle cx="16" cy="32" r="1"/><path d="M22 32h10"/>',
    home:'<path d="M6 23 24 8l18 15M11 21v19h26V21"/><rect x="20" y="28" width="8" height="12" rx="1"/><path d="M19 19a8 8 0 0 1 10 0m-7 4a3 3 0 0 1 4 0"/>',
    access:'<rect x="12" y="5" width="24" height="38" rx="5"/><rect x="17" y="11" width="14" height="10" rx="2"/><path d="M18 27h2m8 0h2m-12 6h2m8 0h2m-8 5h4"/>',
    disk:'<rect x="9" y="5" width="30" height="38" rx="5"/><circle cx="24" cy="21" r="10"/><circle cx="24" cy="21" r="3"/><path d="m26 23 8 11M15 37h8"/>',
    fiber:'<ellipse cx="22" cy="19" rx="13" ry="6"/><path d="M9 19v11c0 8 26 8 26 0V19M9 24c0 8 26 8 26 0m-26 6c0 8 26 8 26 0m0-8 6-9m-3 0 5 3"/>',
    cable:'<path d="M15 8v9c0 12 20 0 20 12v5c0 11-23 11-23 0v-5"/><rect x="8" y="3" width="14" height="9" rx="2"/><path d="M12 3V0m6 3V0"/><rect x="6" y="22" width="12" height="9" rx="2"/>',
    power:'<rect x="9" y="7" width="30" height="35" rx="4"/><path d="m26 13-9 13h8l-3 10 10-15h-8zM16 4h16"/>',
    alarm:'<path d="M10 32v-9a14 14 0 0 1 28 0v9l4 6H6zM20 42h8M24 15v9"/><circle cx="24" cy="29" r="1"/><path d="m5 9 4 4m30 0 4-4"/>',
    chip:'<rect x="12" y="12" width="24" height="24" rx="3"/><rect x="18" y="18" width="12" height="12" rx="2"/><path d="M18 5v7m12-7v7M18 36v7m12-7v7M5 18h7m-7 12h7m24-12h7m-7 12h7"/>',
    all:'<path d="m24 5 5 13 14 6-14 5-5 14-5-14-14-5 14-6z"/>'
  };
  const iconNames=Object.freeze(Object.keys(paths));
  function iconSvg(name){
    return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.chip)+'</svg>';
  }
  function matchesSection(product,section){
    if(!section)return true;
    if(section.kind==='brand')return section.matchBrands.some(brand=>normalize(product.brand)===normalize(brand));
    const text=[product.name,product.model,product.spec,product.description,product.brand].filter(Boolean).join(' ').toLowerCase();
    return section.keywords.some(word=>text.includes(word.toLowerCase())||normalize(product.category||product.cat)===normalize(word));
  }
  function categoryIcon(name){
    if(/kamer/i.test(name))return 'camera';
    if(/dvr|nvr/i.test(name))return 'recorder';
    if(/tarmoq/i.test(name))return 'network';
    if(/kabel|optik/i.test(name))return 'fiber';
    if(/xotira/i.test(name))return 'disk';
    if(/quvvat|ups/i.test(name))return 'power';
    if(/domofon|kirish/i.test(name))return 'access';
    if(/signal|yong/i.test(name))return 'alarm';
    if(/aqlli/i.test(name))return 'home';
    return name==='Barchasi'?'all':'chip';
  }
  root.UzCamBrandConfig=Object.freeze({defaults:sections,normalize,matchesSection,iconSvg,iconNames,categoryIcon});
})(globalThis);
