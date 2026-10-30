import dahuaProducts from './dahua-2024-products.js';

const migrationKey = 'dahua_catalog_import_2026_10_30';
const usdRate = 11965.51;
const rateDate = '2026-10-22';
const defaultMarkup = 30;

function salePrice(usd, markup) {
  return Math.round(Number(usd) * usdRate * (1 + Number(markup) / 100));
}

export async function importDahuaCatalog(db) {
  return db.transaction(async () => {
    if (db.kind === 'postgres') await db.get('SELECT pg_advisory_xact_lock(8256303)');
    if (await db.get('SELECT 1 FROM settings WHERE key = ?', migrationKey)) return { imported: 0, skipped: dahuaProducts.length };

    const markupRow = await db.get('SELECT value FROM settings WHERE key = ?', 'markup_percent');
    const markup = Number.isFinite(Number(markupRow?.value)) ? Number(markupRow.value) : defaultMarkup;

    for (const category of new Set(dahuaProducts.map(product => product.category))) {
      await db.run('INSERT INTO categories(name, is_active) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET is_active = 1', category);
    }
    const categories = new Map((await db.all('SELECT id, name FROM categories')).map(row => [row.name, row.id]));

    await db.run(
      'INSERT INTO exchange_rates(currency, rate_to_uzs, effective_date, source) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
      'USD', usdRate, rateDate, 'CBU official USD rate'
    );

    let imported = 0;
    for (let start = 0; start < dahuaProducts.length; start += 50) {
      const chunk = dahuaProducts.slice(start, start + 50);
      const values = [];
      for (const product of chunk) {
        values.push(
          product.model, product.name, product.brand, categories.get(product.category),
          product.description || '', '', product.sourcePrice, 'USD', usdRate,
          salePrice(product.sourcePrice, markup), 1
        );
      }
      const result = await db.run(
        'INSERT INTO products(model, name, brand, category_id, description, image_path, source_price, source_currency, rate_used, sale_price_uzs, is_active) VALUES ' +
        chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',') +
        ' ON CONFLICT(model) DO NOTHING',
        ...values
      );
      imported += Number(result.changes || 0);
    }

    const brandRow = await db.get('SELECT value FROM settings WHERE key = ?', 'catalog_brands_v1');
    if (brandRow) {
      try {
        const brands = JSON.parse(brandRow.value);
        if (Array.isArray(brands) && !brands.some(brand => String(brand.id) === 'dahua')) {
          brands.push({ id: 'dahua', name: 'Dahua', icon: 'camera', matchBrands: ['Dahua'], keywords: [], kind: 'brand', logo: '', order: 2, isActive: true });
          await db.run('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', JSON.stringify(brands), 'catalog_brands_v1');
        }
      } catch {}
    }

    await db.run(
      'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING',
      migrationKey,
      JSON.stringify({ importedAt: new Date().toISOString(), sourceProducts: dahuaProducts.length, usdRate, rateDate, markup })
    );
    return { imported, skipped: dahuaProducts.length - imported };
  });
}
