const normalize = value => String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();

export function classifyProduct(product) {
  const text = normalize([product.model, product.name, product.description].filter(Boolean).join(' '));
  const brand = normalize(product.brand);
  if (/(^|\s)(DHI-)?NVR\b|\bDH-?XVR\b|\bDVR\b|\bDS-76\d{2}\b|\bDS-77\d{2}\b/.test(text)) {
    return brand === 'DAHUA' ? 'Dahua NVR' : 'DVR/NVR';
  }
  if (/\bDH-IPC\b|\bIPC-[A-Z0-9]|\bDS-2CD\b|\bDS-2CE\b|\bIP CAMERA\b|\bKAMERA\b|\bCAMERA\b/.test(text)) return 'Kameralar';
  if (/\bDHI-(VTO|VTH|ASI)\b|\bDOMOFON\b|\bINTERCOM\b|\bDOOR ?PHONE\b|\bACCESS CONTROL\b/.test(text)) return 'Domofon va kirish nazorati';
  if (/\bHDD\b|\bSSD\b|\bMICRO ?SD\b|\bMEMORY CARD\b|\bSD CARD\b|\bFLASH DRIVE\b/.test(text)) return 'Xotira qurilmalari';
  if (/\bUTP\b|\bFTP\b|\bPATCH ?CORD\b|\bPIGTAIL\b|\bOPTIC\b|\bFIBER\b|\bRG[- ]?59\b|\bKABEL\b|КАБЕЛ|\bCABLE\b/.test(text)) return 'Kabel va optika';
  if (/\bCPE\b|\bANTENNA\b|\bLITEBEAM\b|\bPOWERBEAM\b|\bROCKET\b|\bSXT\b|\bLHG\b|\bROUTER\b|\bSWI?TCH\b|\bKOMMUTATOR\b|\bDH-PFS\b|\bPOE\b|\bACCESS POINT\b|\bWI-(CPE|LTE|R)\b/.test(text)) return 'Tarmoq uskunalari';
  return '';
}

export async function normalizeProductCategories(db) {
  return db.transaction(async () => {
    if (db.kind === 'postgres') await db.get('SELECT pg_advisory_xact_lock(8256304)');
    const products = await db.all(`SELECT p.id, p.model, p.name, p.brand, p.description, c.name AS category
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = 1 AND p.deleted_at IS NULL`);
    const updates = products.map(product => ({ id: product.id, category: classifyProduct(product) }))
      .filter(product => product.category && product.category !== products.find(row => row.id === product.id)?.category);
    if (!updates.length) return { updated: 0 };
    for (const category of new Set(updates.map(update => update.category))) {
      await db.run('INSERT INTO categories(name, is_active) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET is_active = 1', category);
    }
    const categories = new Map((await db.all('SELECT id, name FROM categories')).map(row => [row.name, row.id]));
    for (const update of updates) await db.run('UPDATE products SET category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', categories.get(update.category), update.id);
    return { updated: updates.length };
  });
}
