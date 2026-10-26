// Shared catalog grouping for browser previews, API validation and database migration.
(function () {
  const categories = Object.freeze([
    'Kameralar', 'DVR/NVR', 'Tarmoq uskunalari', 'Kabel va optika',
    'Xotira qurilmalari', 'Quvvat, UPS va aksessuarlar',
    'Domofon va kirish nazorati', 'Signalizatsiya va yong‘in xavfsizligi',
    'Aqlli uy', 'Elektronika'
  ]);
  const aliases = Object.freeze({
    'Aksessuarlar': 'Quvvat, UPS va aksessuarlar',
    'Quvvat va UPS': 'Quvvat, UPS va aksessuarlar',
    'Domofonlar': 'Domofon va kirish nazorati',
    'Kirish nazorati': 'Domofon va kirish nazorati',
    'Ovozli ogohlantirish': 'Signalizatsiya va yong‘in xavfsizligi',
    'Asboblar': 'Elektronika'
  });
  globalThis.UzCamCategoryConfig = Object.freeze({
    categories, aliases,
    canonical: value => { const name=String(value || '').trim();return Object.hasOwn(aliases,name)?aliases[name]:name; }
  });
})();
