import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { postgresTls } from '../backend/postgres-tls.js';

test('Supabase pooler gets official CA and keeps strict TLS validation',()=>{
  const config=postgresTls('aws-0-us-east-1.pooler.supabase.com',{});
  assert.equal(config.rejectUnauthorized,true);
  const certificate=new X509Certificate(config.ca.at(-1));
  assert.equal(certificate.ca,true);
  assert.equal(certificate.verify(certificate.publicKey),true);
  assert.equal(certificate.fingerprint256,'80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
  assert.equal(postgresTls('db.project.supabase.co',{}).rejectUnauthorized,true);
  assert.deepEqual(postgresTls('aws-0-us-east-1.pooler.supabase.com.attacker.invalid',{}),{rejectUnauthorized:true});
  assert.deepEqual(postgresTls('other.example.com',{}),{rejectUnauthorized:true});
  assert.equal(postgresTls('127.0.0.1',{}),false);
  assert.throws(()=>postgresTls('aws-0-us-east-1.pooler.supabase.com',{PGSSLROOTCERT:'missing-ca-cert.crt'}));
});
