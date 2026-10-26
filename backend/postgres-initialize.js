import fs from 'node:fs';

export const snapshotTables = ['users','categories','products','exchange_rates','orders','order_items','payments','work_claims','settings','audit_log','support_threads','support_message_links','worker_profiles'];
const identifier = value => '"' + value.replaceAll('"','""') + '"';

export async function resetSequences(database) {
  for (const table of ['users','categories','products','exchange_rates','orders','order_items','payments','work_claims','audit_log']) {
    await database.get(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), EXISTS(SELECT 1 FROM ${table}))`);
  }
}

export async function importSnapshot(database, snapshot) {
  if (snapshot?.format !== 'uzcam-sqlite-v1' || !snapshot.tables || !snapshot.images) throw new Error('UzCam zaxira fayli noto‘g‘ri');
  return database.transaction(async () => {
    await database.get('SELECT pg_advisory_xact_lock(8256301)');
    for (const table of snapshotTables.filter(name => name !== 'settings')) {
      if (await database.get(`SELECT 1 FROM ${table} LIMIT 1`)) throw new Error('Import faqat bo‘sh bazaga bajariladi; mavjud ma’lumotlar ustiga yozilmaydi');
    }
    const summary = {};
    for (const table of snapshotTables) {
      const rows = snapshot.tables[table];
      if (!Array.isArray(rows)) throw new Error('Zaxirada jadval yo‘q: ' + table);
      const allowed = new Set((await database.all('SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?', 'public', table)).map(row=>row.column_name));
      for (const row of rows) {
        const columns = Object.keys(row).filter(column=>allowed.has(column));
        if (!columns.length) throw new Error('Bo‘sh import yozuvi');
        const conflict = table === 'settings' ? ' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at' : '';
        await database.run(`INSERT INTO ${table} (${columns.map(identifier).join(',')}) VALUES (${columns.map(()=>'?').join(',')})${conflict}`, ...columns.map(column=>row[column]));
      }
      summary[table] = rows.length;
    }
    for (const item of snapshot.images) {
      if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(item.name) || !['image/png','image/jpeg','image/webp'].includes(item.contentType)) throw new Error('Zaxiradagi rasm nomi noto‘g‘ri');
      const bytes=Buffer.from(item.base64,'base64');
      if (!bytes.length || bytes.length > 3145728) throw new Error('Zaxiradagi rasm hajmi noto‘g‘ri');
      await database.run('INSERT INTO product_image_files(name,content_type,bytes) VALUES (?,?,?)',item.name,item.contentType,bytes);
    }
    await resetSequences(database);
    await database.run("INSERT INTO settings(key,value) VALUES ('catalog_initialized','true') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value");
    return summary;
  });
}

export async function initializePostgres(database, options = {}) {
  await database.transaction(async () => {
    await database.get('SELECT pg_advisory_xact_lock(8256301)');
    await database.exec("CREATE TABLE IF NOT EXISTS uzcam_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); ALTER TABLE uzcam_migrations ENABLE ROW LEVEL SECURITY;");
    if (!(await database.get("SELECT 1 FROM uzcam_migrations WHERE version='supabase-v1'"))) {
      await database.exec(fs.readFileSync(new URL('./supabase/runtime-schema.sql',import.meta.url),'utf8'));
      await database.exec("DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON uzcam_migrations FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON uzcam_migrations FROM authenticated; END IF; END $$;");
      await database.run("INSERT INTO uzcam_migrations(version) VALUES ('supabase-v1')");
    }
  });
  const importFile=options.importFile ?? process.env.UZCAM_IMPORT_FILE;
  if (importFile) { await importSnapshot(database,JSON.parse(fs.readFileSync(importFile,'utf8'))); return; }
  const catalog=options.catalog ?? JSON.parse(fs.readFileSync(new URL('./catalog.json',import.meta.url),'utf8'));
  await database.transaction(async () => {
    await database.get('SELECT pg_advisory_xact_lock(8256301)');
    if (await database.get("SELECT 1 FROM settings WHERE key='catalog_initialized'")) return;
    if (!(await database.get('SELECT 1 FROM products LIMIT 1'))) {
      for (const category of new Set(catalog.products.map(item=>item.category))) await database.run('INSERT INTO categories(name) VALUES (?) ON CONFLICT (name) DO NOTHING',category);
      const categories=new Map((await database.all('SELECT id,name FROM categories')).map(row=>[row.name,row.id]));
      for(let start=0;start<catalog.products.length;start+=100) {
        const chunk=catalog.products.slice(start,start+100), params=[];
        for(const p of chunk) params.push(p.id,p.model,p.name,p.brand,categories.get(p.category),p.description||'',p.image||'',p.source_price??null,p.source_currency??null,p.rate_used??null,p.sale_price_uzs);
        await database.run('INSERT INTO products(id,model,name,brand,category_id,description,image_path,source_price,source_currency,rate_used,sale_price_uzs) VALUES '+chunk.map(()=>'(?,?,?,?,?,?,?,?,?,?,?)').join(',')+' ON CONFLICT DO NOTHING',...params);
      }
      if(catalog.exchange_rate) {
        const rate=catalog.exchange_rate;
        await database.run('INSERT INTO exchange_rates(currency,rate_to_uzs,effective_date,source) VALUES (?,?,?,?) ON CONFLICT DO NOTHING',rate.currency,rate.rate_to_uzs,rate.effective_date,rate.source);
      }
    }
    await resetSequences(database);
    await database.run("INSERT INTO settings(key,value) VALUES ('catalog_initialized','true') ON CONFLICT (key) DO NOTHING");
  });
}
