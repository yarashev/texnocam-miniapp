import fs from 'node:fs';
import { rootCertificates } from 'node:tls';

// Supabase's shared pooler uses its own CA. Keep hostname and chain verification on.
export function postgresTls(hostname, env = process.env) {
  if (['localhost','127.0.0.1','::1','[::1]'].includes(hostname)) return false;
  if (env.PGSSLROOTCERT) return {rejectUnauthorized:true,ca:fs.readFileSync(env.PGSSLROOTCERT,'utf8')};
  if (/(?:^|\.)(?:supabase\.co|pooler\.supabase\.com)$/i.test(hostname)) {
    return {rejectUnauthorized:true,ca:[...rootCertificates,fs.readFileSync(new URL('./certs/supabase-prod-ca-2021.crt',import.meta.url),'utf8')]};
  }
  return {rejectUnauthorized:true};
}
