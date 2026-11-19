import {randomUUID} from 'node:crypto';
export const LEASE_SECONDS=120;
export const utc=value=>new Date(value).toISOString().slice(0,19).replace('T',' ');
export async function initializeNotificationDelivery(db){
  const fields={lease_until:'TEXT',lease_token:'TEXT',delivery_json:'TEXT'};
  if(db.kind==='postgres')for(const [name,type]of Object.entries(fields))await db.run('ALTER TABLE customer_notifications ADD COLUMN IF NOT EXISTS '+name+' '+type);
  else{
    const columns=await db.all('PRAGMA table_info(customer_notifications)');
    for(const [name,type]of Object.entries(fields))if(!columns.some(c=>c.name===name))await db.run('ALTER TABLE customer_notifications ADD COLUMN '+name+' '+type);
  }
  // An older instance might still be finishing a send during a rolling deploy.
  await db.run("UPDATE customer_notifications SET lease_until=? WHERE delivery_status='sending' AND lease_until IS NULL",utc(Date.now()+LEASE_SECONDS*1000));
  await db.run('CREATE INDEX IF NOT EXISTS customer_notifications_lease_idx ON customer_notifications(delivery_status,lease_until)');
}
export async function recoverNotificationLeases(db,now=Date.now()){
  return db.run("UPDATE customer_notifications SET delivery_status=CASE WHEN attempts>=8 THEN 'failed' ELSE 'pending' END,lease_token=NULL,lease_until=NULL,last_error='Interrupted send; delivery lease expired' WHERE delivery_status='sending' AND lease_until IS NOT NULL AND lease_until<=?",utc(now));
}
export function notificationLease(){return {token:randomUUID(),until:utc(Date.now()+LEASE_SECONDS*1000)}}
