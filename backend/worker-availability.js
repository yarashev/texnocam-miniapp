export function availability(row,now=Date.now()){
 const until=row?.busy_until ? (row.busy_until instanceof Date?row.busy_until.getTime():Date.parse(String(row.busy_until).replace(' ','T')+'Z')):null;
 const busy=row?.mode==='busy'&&(until===null||until>now);
 return {mode:busy?'busy':'available',busyUntil:busy&&until!==null?new Date(until).toISOString():null};
}
export function busyDeadline(duration,now=Date.now()){
 if(duration==='manual')return null;
 if(duration==='hour')return new Date(now+3600000).toISOString().slice(0,19).replace('T',' ');
 if(duration==='today'){const end=new Date(now+5*3600000);end.setUTCHours(24,0,0,0);return new Date(end.getTime()-5*3600000).toISOString().slice(0,19).replace('T',' ')}
 throw Object.assign(new Error('Bandlik muddatini tanlang'),{statusCode:400});
}
export async function initializeAvailability(db){
 await db.run("CREATE TABLE IF NOT EXISTS worker_availability (worker_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, mode TEXT NOT NULL DEFAULT 'available' CHECK(mode IN ('available','busy')), busy_until TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
}
export async function getAvailability(db,workerId){
 return availability(await db.get('SELECT mode,busy_until FROM worker_availability WHERE worker_id=?',workerId));
}
export async function setAvailability(db,actor,target,mode,duration){
 if(!actor||(!['worker','super_admin'].includes(actor.role))||(actor.role==='worker'&&Number(actor.id)!==Number(target)))throw Object.assign(new Error('Ruxsat yo‘q'),{statusCode:403});
 if(!['available','busy'].includes(mode))throw Object.assign(new Error('Holat noto‘g‘ri'),{statusCode:400});
 const until=mode==='busy'?busyDeadline(duration):null;
 return db.transaction(async()=>{
 const user=await db.get("SELECT id FROM users WHERE id=? AND role='worker' AND is_active=1",target);
 if(!user)throw Object.assign(new Error('Faol usta topilmadi'),{statusCode:404});
 await db.run('UPDATE users SET is_active=is_active WHERE id=?',target);
 await db.run('INSERT INTO worker_availability(worker_id,mode,busy_until) VALUES (?,?,?) ON CONFLICT(worker_id) DO UPDATE SET mode=excluded.mode,busy_until=excluded.busy_until,updated_at=CURRENT_TIMESTAMP',target,mode,until);
 await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?,'availability','worker_profile',?,?)",actor.id,String(target),JSON.stringify({mode,busyUntil:until}));
 return getAvailability(db,target);
 });
}
