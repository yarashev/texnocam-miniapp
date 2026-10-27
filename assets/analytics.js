(() => {
  "use strict";
  const cleanProperties = value => Object.fromEntries(Object.entries(value || {}).filter(([, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean").map(([key, item]) => [key, typeof item === "string" ? item.slice(0, 80) : item]));
  const addScript = (src, onload) => { const script = document.createElement("script"); script.async = true; script.src = src; script.onload = onload; document.head.append(script); };
  const state = { ga4: false, clarity: false, sentry: false };
  window.UzCamAnalytics = {
    track(name, properties = {}) {
      const safe = cleanProperties(properties);
      if (state.ga4 && typeof window.gtag === "function") window.gtag("event", name, safe);
      if (state.clarity && typeof window.clarity === "function") window.clarity("event", name);
      if (state.sentry && window.Sentry) window.Sentry.addBreadcrumb({ category: "analytics", message: name, data: safe, level: "info" });
    }
  };
  const track = window.UzCamAnalytics.track;
  fetch("/api/public-config", { cache: "no-store" }).then(response => response.ok ? response.json() : {}).then(({ analytics = {} }) => {
    if (/^G-[A-Z0-9]+$/.test(analytics.ga4MeasurementId || "")) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", analytics.ga4MeasurementId, { send_page_view: true, allow_google_signals: false });
      addScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(analytics.ga4MeasurementId));
      state.ga4 = true;
    }
    if (/^[A-Za-z0-9-]{6,80}$/.test(analytics.clarityProjectId || "")) {
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      addScript("https://www.clarity.ms/tag/" + encodeURIComponent(analytics.clarityProjectId));
      state.clarity = true;
    }
    if (/^https:\/\//.test(analytics.sentryBrowserDsn || "")) {
      const key = analytics.sentryBrowserDsn.match(/^https:\/\/([^@/]+)@/);
      if (key) addScript("https://js.sentry-cdn.com/" + encodeURIComponent(key[1]) + ".min.js", () => {
        if (!window.Sentry) return;
        window.Sentry.onLoad(() => window.Sentry.init({ dsn: analytics.sentryBrowserDsn, tracesSampleRate: 0.1 }));
        state.sentry = true;
      });
    }
  }).catch(() => {});

  document.addEventListener("click", event => {
    const control = event.target.closest("button,a");
    if (!control) return;
    if (control.id === "catalogPhone") track("contact_phone_click");
    else if (control.id === "cart") track("view_cart");
    else if (control.id === "toDelivery") track("begin_checkout");
    else if (control.id === "showAll") track("view_all_categories");
    else if (control.id === "brandPickerButton") track("open_brand_filter");
    else if (control.id === "pricePickerButton") track("open_price_filter");
    else if (control.matches(".add") || control.textContent.includes("Savatchaga qo‘shish")) track("add_to_cart");
    else if (control.matches("[data-promo-index]")) track("select_promotion");
  }, { passive: true });

  let searchTimer;
  document.addEventListener("input", event => {
    if (event.target.id !== "search") return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = event.target.value.trim();
      if (query.length > 1) track("search", { query_length: query.length });
    }, 800);
  });
})();
