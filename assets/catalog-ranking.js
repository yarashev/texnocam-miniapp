// Lightweight, explainable catalog ranking shared by the mini app and tests.
(function (root) {
  "use strict";
  const letters={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'x',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ь:'',ы:'i',э:'e',ю:'yu',я:'ya',ў:'o',қ:'q',ғ:'g',ҳ:'h'};
  const normalizeSearch=value=>String(value??'').toLowerCase().normalize('NFKC').replace(/[а-яёўқғҳ]/g,c=>letters[c]).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/['‘’ʻʼ\u0060]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const aliases={camera:'kamera',cameras:'kamera',kameralar:'kamera',kamery:'kamera',videokamera:'kamera',megapiksel:'mp',megapixel:'mp'};
  const canonical=word=>aliases[word]||word;
  const popularityScore=product=>Math.log1p(Math.max(0,Number(product.soldQty)||0))*5+Math.log1p(Math.max(0,Number(product.cartAdds)||0))*2+Math.log1p(Math.max(0,Number(product.views)||0))*0.7+(product.image?0.25:0);
  const cache=new WeakMap();
  function indexProduct(product){
    const values=[product.model,product.name,product.brand,product.spec,product.description,product.category||product.cat];
    const stamp=JSON.stringify(values),previous=cache.get(product);
    if(previous?.stamp===stamp)return previous;
    const fields=values.map(normalizeSearch),entry={stamp,fields,joined:fields.map(v=>v.replace(/ /g,'')),words:fields.map(v=>v.split(' ').filter(Boolean).map(canonical))};
    cache.set(product,entry);return entry;
  }
  function oneTypo(a,b){
    if(a===b)return true;
    if(Math.abs(a.length-b.length)>1)return false;
    if(a.length===b.length){
      const diff=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff.push(i);
      return diff.length===1||(diff.length===2&&diff[1]===diff[0]+1&&a[diff[0]]===b[diff[1]]&&a[diff[1]]===b[diff[0]]);
    }
    if(a.length>b.length)[a,b]=[b,a];
    let i=0,j=0,skipped=false;
    while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;}else{if(skipped)return false;skipped=true;j++;}}
    return true;
  }
  function prepareQuery(value){
    const text=normalizeSearch(value).slice(0,160);
    return {text,joined:text.replace(/ /g,''),tokens:text.split(' ').filter(Boolean).slice(0,16).map(canonical)};
  }
  function scoreProduct(product,query){
    if(!query.tokens.length)return 0;
    const index=indexProduct(product),weights=[140,110,80,40,30,35];
    for(const i of [0,1])if(index.joined[i]&&index.joined[i]===query.joined)return 10000+(i===0?100:0);
    let total=0;
    for(const token of query.tokens){
      let best=0;
      for(let i=0;i<index.fields.length;i++){
        const words=index.words[i],weight=weights[i];
        if(words.includes(token))best=Math.max(best,weight+30);
        else if(index.fields[i].includes(token)||index.joined[i].includes(token))best=Math.max(best,weight);
        else if(token.length>=4&&!/\d/.test(token)&&words.some(word=>!/\d/.test(word)&&word.length>=4&&oneTypo(token,word)))best=Math.max(best,weight*0.3);
      }
      if(!best)return -1;
      total+=best;
    }
    if(index.joined[0].includes(query.joined)||index.joined[1].includes(query.joined))total+=400;
    return total;
  }
  const relevanceScore=(product,tokens)=>scoreProduct(product,prepareQuery(tokens.join(' ')));
  function rankProducts(products,options={}){
    const query=prepareQuery(options.query??(Array.isArray(options.tokens)?options.tokens.join(' '):''));
    const scores=new Map();
    let selected=products.filter(product=>{const score=scoreProduct(product,query);scores.set(product,score);return score>=0;}).sort((a,b)=>Number(a.price)-Number(b.price));
    const tier=options.priceTier||'all';
    if(tier!=='all'){
      const split1=Math.ceil(selected.length/3),split2=Math.ceil(selected.length*2/3);
      selected=tier==='cheap'?selected.slice(0,split1):tier==='medium'?selected.slice(split1,split2):tier==='expensive'?selected.slice(split2):selected;
    }
    return selected.sort((a,b)=>(query.tokens.length?scores.get(b)-scores.get(a):0)||popularityScore(b)-popularityScore(a)||Number(a.price)-Number(b.price)||String(a.id).localeCompare(String(b.id)));
  }
  function rankHomeCameras(products, options = {}) {
    const minPrice=Number(options.minPrice??400000),maxPrice=Number(options.maxPrice??800000),limit=Math.max(0,Math.floor(Number(options.limit??6)));
    const brands=['ezviz','hikvision'],targetPrice=(minPrice+maxPrice)/2;
    const eligible=products.filter(product=>normalizeSearch(product.category||product.cat)==='kameralar'&&brands.includes(String(product.brand||'').trim().toLowerCase())&&Number(product.price??product.price_uzs)>=minPrice&&Number(product.price??product.price_uzs)<=maxPrice);
    const homeFit=product=>{const text=normalizeSearch([product.name,product.spec,product.description].filter(Boolean).join(' '));const cues=['wifi','wi fi','wireless','indoor','home','xonadon','pan tilt','h1c','h6c','c6n','h7c'];return cues.reduce((score,cue)=>score+(text.includes(cue)?1:0),0)-( /outdoor|tashqi|bullet/.test(text)?1:0)};
    const sorted=brands.map(brand=>eligible.filter(product=>String(product.brand||'').trim().toLowerCase()===brand).sort((a,b)=>homeFit(b)-homeFit(a)||popularityScore(b)-popularityScore(a)||Math.abs(Number(a.price??a.price_uzs)-targetPrice)-Math.abs(Number(b.price??b.price_uzs)-targetPrice)||Number(a.price??a.price_uzs)-Number(b.price??b.price_uzs)));
    const ranked=[];
    for(let index=0;ranked.length<limit&&sorted.some(group=>index<group.length);index++)for(const group of sorted)if(group[index])ranked.push(group[index]);
    return ranked.slice(0,limit);
  }
  function rankInitialCatalog(products, options = {}) {
    const featured=rankHomeCameras(products,options),featuredIds=new Set(featured.map(product=>String(product.id)));
    const cameras=rankProducts(products.filter(product=>normalizeSearch(product.category||product.cat)==='kameralar'&&!featuredIds.has(String(product.id))));
    const recorders=rankProducts(products.filter(product=>{const category=normalizeSearch(product.category||product.cat);return category.includes('dvr')||category.includes('nvr')}));
    const cables=products.filter(product=>/kabel|optika/.test(normalizeSearch(product.category||product.cat)));
    const cableIds=new Set(cables.map(product=>String(product.id)));
    const cameraIds=new Set(cameras.map(product=>String(product.id)));
    const recorderIds=new Set(recorders.map(product=>String(product.id)));
    const other=rankProducts(products.filter(product=>!featuredIds.has(String(product.id))&&!cameraIds.has(String(product.id))&&!recorderIds.has(String(product.id))&&!cableIds.has(String(product.id))));
    const priority=[];let cameraIndex=0,recorderIndex=0;
    while(cameraIndex<cameras.length||recorderIndex<recorders.length){
      for(let count=0;count<2&&cameraIndex<cameras.length;count++)priority.push(cameras[cameraIndex++]);
      if(recorderIndex<recorders.length)priority.push(recorders[recorderIndex++]);
    }
    return [...featured,...priority,...other,...rankProducts(cables)];
  }
  root.UzCamCatalogRanking = Object.freeze({ normalizeSearch, popularityScore, relevanceScore, rankProducts, rankHomeCameras, rankInitialCatalog });
})(globalThis);
