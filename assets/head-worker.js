(()=>{
const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
let workers=[],services=[],editing=null,pricing=null;
async function api(path,method='GET',body){const res=await fetch(path,{method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw Error(data.error||'Amal bajarilmadi');return data}
const url=tg=>'/api/worker-management/workers'+(tg?'/'+tg:'');
const money=p=>new Intl.NumberFormat('uz-UZ').format(p)+' so‘m';
async function refresh(){try{const data=await api(url());workers=data.workers;services=data.services;$('notice').textContent='';$('workspace').hidden=false;draw()}catch(e){$('notice').textContent=e.message}}
function draw(){
 const q=$('search').value.trim().toLowerCase(),filter=$('filter').value;
 $('summary').textContent='Jami: '+workers.length+' · Bo‘sh: '+workers.filter(w=>w.is_active&&w.availability.mode==='available').length+' · Band: '+workers.filter(w=>w.is_active&&w.availability.mode==='busy').length+' · Faol emas: '+workers.filter(w=>!w.is_active).length;
 const host=$('workers');host.replaceChildren();
 const visible=workers.filter(w=>(filter==='all'||(filter==='inactive'?!w.is_active:w.is_active&&w.availability.mode===filter))&&[w.full_name,w.telegram_id,w.service_region,w.service_city,w.service_district].join(' ').toLowerCase().includes(q));
 if(!visible.length)host.append(node('p','Usta topilmadi.'));
 for(const w of visible){
 const card=node('article');card.append(node('h2',w.full_name),node('small','Telegram ID: '+w.telegram_id),node('p',!w.is_active?'🔴 Faol emas':w.availability.mode==='busy'?'🟡 Vaqtincha band':'🟢 Bo‘sh','badge'));
 const area=[w.service_region,w.service_city,w.service_district].filter(Boolean).join(', ');if(area)card.append(node('p',area));if(w.experience_years)card.append(node('p',w.experience_years+' yil tajriba'));if(w.phone)card.append(node('p',w.phone));
 for(const r of w.rates){const service=services.find(s=>s.id===r.service_id);if(service)card.append(node('p',service.name+': '+money(r.price_uzs)))}
 const actions=node('div',undefined,'actions');
 const button=(label,fn,cls)=>{const b=node('button',label,cls);b.onclick=fn;actions.append(b);return b};
 button('Tahrirlash',()=>edit(w));button('Xizmat va narxlar',()=>prices(w));button('Ishlari',()=>jobs(w));
 const duration=document.createElement('select');duration.setAttribute('aria-label','Bandlik muddati');for(const [value,label] of [['hour','1 soat'],['today','Bugun oxirigacha'],['manual','O‘zi yoqquncha']])duration.add(new Option(label,value));actions.append(duration);
 const availability=button(w.availability.mode==='busy'?'Bo‘sh qilish':'Band qilish',async()=>{availability.disabled=true;try{await api('/api/worker/availability','POST',{telegramId:w.telegram_id,mode:w.availability.mode==='busy'?'available':'busy',duration:duration.value});await refresh()}catch(e){$('notice').textContent=e.message;availability.disabled=false}});availability.disabled=!w.is_active;
 button(w.is_active?'Faolsizlantirish':'Faollashtirish',async()=>{try{await api(url(w.telegram_id)+'/active','PUT',{isActive:!w.is_active});await refresh()}catch(e){$('notice').textContent=e.message}});
 button('O‘chirish',async()=>{if(!confirm(w.full_name+' ustasining profili va xizmat narxlari butunlay o‘chirilsinmi?'))return;try{await api(url(w.telegram_id),'DELETE');await refresh()}catch(e){$('notice').textContent=e.message}},'danger');card.append(actions);host.append(card);
 }}
function edit(w){editing=w?.telegram_id||null;const f=$('workerForm');f.reset();$('workerError').textContent='';
 if(w){const fields={telegramId:w.telegram_id,fullName:w.full_name,telegramUsername:w.telegram_username,experienceYears:w.experience_years,serviceRegion:w.service_region,serviceCity:w.service_city,serviceDistrict:w.service_district};for(const [key,value] of Object.entries(fields))f.elements[key].value=value||'';String(w.phone||'').split(',').forEach((p,i)=>{if(i<3)f.elements['phone'+(i+1)].value=p});f.elements.isPublic.checked=!!w.is_public}$('editor').showModal()}
$('workerForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,b=form.querySelector('[type=submit]');b.disabled=true;const body=Object.fromEntries(new FormData(form));body.phone=[body.phone1,body.phone2,body.phone3].filter(v=>v?.trim()).join(',');body.isPublic=form.elements.isPublic.checked;
 try{await api(url(editing),editing?'PUT':'POST',body);$('editor').close();await refresh()}catch(error){$('workerError').textContent=error.message}finally{b.disabled=false}};
function prices(w){pricing=w.telegram_id;$('priceError').textContent='';$('pricesTitle').textContent=w.full_name+' — xizmat narxlari';const host=$('rateFields');host.replaceChildren();for(const s of services){const label=node('label',s.name,'rate-row'),input=document.createElement('input');input.type='number';input.min=1;input.max=1000000000;input.step=1;input.placeholder='Narx (so‘m)';input.dataset.service=s.id;input.value=w.rates.find(r=>r.service_id===s.id)?.price_uzs||'';label.append(input);host.append(label)}$('prices').showModal()}
$('priceForm').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('[type=submit]');b.disabled=true;try{const rates=[...$('rateFields').querySelectorAll('input')].filter(i=>i.value!=='').map(i=>({service_id:i.dataset.service,price_uzs:Number(i.value)}));await api(url(pricing)+'/rates','PUT',{rates});$('prices').close();await refresh()}catch(error){$('priceError').textContent=error.message}finally{b.disabled=false}};
function jobs(w){const labels={accepted:'Qabul qilingan',travelling:'Yo‘lga chiqqan',working:'Bajarilmoqda',awaiting_customer:'Mijoz tasdig‘i kutilmoqda',disputed:'Dispetcher ko‘rib chiqmoqda',completed:'Yakunlangan',cancelled:'Bekor qilingan'};const host=$('jobList');host.replaceChildren();if(!w.jobs.length)host.append(node('p','Biriktirilgan ishlar yo‘q.'));for(const j of w.jobs)host.append(node('p',j.order_number+' · '+(labels[j.state]||j.state)+(j.rating?' · '+j.rating+' ⭐':'')));$('jobs').showModal()}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());$('add').onclick=()=>edit(null);$('refresh').onclick=refresh;$('search').oninput=draw;$('filter').onchange=draw;
(async()=>{try{const result=await api('/api/session');if(!['head_worker','super_admin'].includes(result.user.role))throw Error('Faqat Bosh usta yoki Super Admin uchun.');await refresh()}catch(e){$('workspace').hidden=true;$('notice').textContent=e.message+' Profil orqali tizimga kiring.'}})();
})();