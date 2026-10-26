import fs from 'node:fs';
import path from 'node:path';
import { exportSqlite } from './sqlite-snapshot.js';
const directory=process.env.UZCAM_DATA_DIR?path.resolve(process.env.UZCAM_DATA_DIR):path.resolve('.data');
const output=path.resolve(process.argv[2] || path.join('backups','uzcam-'+new Date().toISOString().replaceAll(':','-')+'.json'));
try {
  const snapshot=exportSqlite(path.join(directory,'texnocam.sqlite'),path.join(directory,'uploads'));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(snapshot),{flag:'wx',mode:0o600});
  console.log('Private backup saved:',output);
}catch {console.error('Backup failed; check the source SQLite path and choose a new output filename.');process.exitCode=1;}
