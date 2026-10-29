import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { snapshotTables } from './postgres-initialize.js';

export function exportSqlite(file, uploadsDirectory) {
  if(!fs.existsSync(file))throw new Error('SQLite fayli topilmadi; to‘g‘ri UZCAM_DATA_DIR ni belgilang');
  const sqlite=new DatabaseSync(file,{readOnly:true});
  const tables={};
  try {
    sqlite.exec('BEGIN');
    for(const table of snapshotTables) {
      const rows=sqlite.prepare('SELECT * FROM '+table).all();
      tables[table]=table==='payment_proof_files'
        ? rows.map(row=>({...row,bytes:Buffer.from(row.bytes).toString('base64')}))
        : rows;
    }
    sqlite.exec('COMMIT');
  } finally { sqlite.close(); }
  const images=[];
  if(fs.existsSync(uploadsDirectory)) for(const name of fs.readdirSync(uploadsDirectory)) {
    if(!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(name))continue;
    const bytes=fs.readFileSync(path.join(uploadsDirectory,name));
    if(bytes.length>3145728)throw new Error('Rasm hajmi chegaradan oshgan: '+name);
    images.push({name,contentType:({'png':'image/png','jpg':'image/jpeg','webp':'image/webp'})[path.extname(name).slice(1)],base64:bytes.toString('base64')});
  }
  return {format:'uzcam-sqlite-v1',exportedAt:new Date().toISOString(),tables,images};
}
