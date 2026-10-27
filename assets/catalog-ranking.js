// Lightweight, explainable catalog ranking shared by the mini app and tests.
(function (root) {
  "use strict";
  const normalizeSearch = value => String(value || "").toLocaleLowerCase("uz").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9а-яё]+/gi, " ").trim();
  const popularityScore = product => Math.log1p(Number(product.soldQty) || 0) * 5 + Math.log1p(Number(product.cartAdds) || 0) * 2 + Math.log1p(Number(product.views) || 0) * 0.7 + (product.image ? 0.25 : 0);
  const relevanceScore = (product, tokens) => {
    if (!tokens.length) return 0;
    const name = normalizeSearch(product.name), brand = normalizeSearch(product.brand), model = normalizeSearch(product.spec);
    let score = 0;
    for (const token of tokens) {
      if (name === token) score += 12;
      else if (name.startsWith(token)) score += 7;
      else if (name.includes(token)) score += 4;
      if (brand === token) score += 5;
      else if (brand.includes(token)) score += 2;
      if (model.includes(token)) score += 2;
    }
    return score;
  };
  function rankProducts(products, options = {}) {
    const tokens = Array.isArray(options.tokens) ? options.tokens : [];
    const tier = options.priceTier || "all";
    const byPrice = products.slice().sort((a, b) => Number(a.price) - Number(b.price));
    let selected = byPrice;
    if (tier !== "all") {
      const split1 = Math.ceil(byPrice.length / 3), split2 = Math.ceil(byPrice.length * 2 / 3);
      selected = tier === "cheap" ? byPrice.slice(0, split1) : tier === "medium" ? byPrice.slice(split1, split2) : tier === "expensive" ? byPrice.slice(split2) : byPrice;
    }
    return selected.slice().sort((a, b) => (relevanceScore(b, tokens) - relevanceScore(a, tokens)) + (popularityScore(b) - popularityScore(a)) || Number(a.price) - Number(b.price));
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
