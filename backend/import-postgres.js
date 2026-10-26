// Run against a newly created, empty database only. Never prints credentials.
import fs from 'node:fs';
const input=process.argv[2];
if(!process.env.DATABASE_URL || !input || !fs.existsSync(input)) {
  console.error('Usage: DATABASE_URL=<private URL> npm run import:postgres -- <private-backup.json>');process.exit(1);
}
process.env.UZCAM_IMPORT_FILE=input;
try {const {db}=await import('./database.js');await db.close();console.log('Import completed. Remove UZCAM_IMPORT_FILE before starting the server.');}
catch {console.error('Import failed. Target must be empty and the backup must be valid. Existing data was not overwritten.');process.exitCode=1;}
