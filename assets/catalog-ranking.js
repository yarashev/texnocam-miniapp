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
  root.UzCamCatalogRanking = Object.freeze({ normalizeSearch, popularityScore, relevanceScore, rankProducts });
})(globalThis);
