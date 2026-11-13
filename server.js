import { initializeServiceWorkflow, serviceAction, listServiceJobs, reviewMarkup } from './backend/service-workflow.js';
import { listCatalogBrands, saveCatalogBrand, deleteCatalogBrand } from './backend/brand-management.js';
import { createReviewedImageLoader } from './backend/reviewed-images.js';
import { initializeImageStorage, saveProductImage, loadProductImage, imageStorageMode } from "./backend/image-storage.js";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { listPublicProducts, listPublicCategories, db } from "./backend/database.js";
import { listManagedProducts, getManagedProduct, saveManagedProduct, changeProductState, productError } from "./backend/product-management.js";
import { listManagedCategories, createCatalogCategory, deactivateCatalogCategory } from "./backend/category-management.js";
import { enqueueCustomerNotification, dispatchCustomerNotifications } from "./backend/customer-notifications.js";

const root = process.cwd();
const reviewedImages = createReviewedImageLoader(JSON.parse(fs.readFileSync(path.join(root, 'assets/product-image-audit.json'), 'utf8')).products);
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".webp":"image/webp", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".svg":"image/svg+xml" };
const sendJson = (res, status, body) => { res.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" }); res.end(JSON.stringify(body)); };


function verifyTelegramInitData(raw) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !raw || raw.length > 8192) return null;
  const params = new URLSearchParams(raw);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash) || !Number.isFinite(authDate)) return null;
  if (Math.abs(Date.now() / 1000 - authDate) > 86400) return null;
  const checkString = [...params.entries()].filter(([key]) => key !== "hash").sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secret).update(checkString).digest();
  const actualHash = Buffer.from(receivedHash, "hex");
  if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) return null;
  try { return JSON.parse(params.get("user") || "null"); } catch { return null; }
}
async function getAdminSession(req) {
  const token = (req.headers.cookie || "").split(";").map(part => part.trim()).find(part => part.startsWith("uzcam_session="))?.slice("uzcam_session=".length);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !botToken) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", botToken).update(payload).digest();
  let actual; try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  let session; try { session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
  if (!session.id || session.exp < Date.now()) return null;
  const user = await db.get("SELECT id, telegram_id, username, full_name, phone, role, is_active FROM users WHERE telegram_id = ?", String(session.id));
  if (!user || !user.is_active || !["admin", "super_admin", "worker"].includes(user.role)) return null;
  return user;
}
async function readJson(req, maxBytes = 10000) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > maxBytes) throw productError("So‘rov hajmi juda katta", 413); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const DEFAULT_HOME_CONTENT = { contactPhone: "+998508554187", hero: { eyebrow: "EZVIZ · aqlli videokuzatuv", title: "Uyingizni EZVIZ bilan himoyalang", description: "CS-H1C (1080P) — uy va biznes uchun aqlli kamera.", productId: 1, buttonText: "Kameralarni ko‘rish" }, videos: [], news: [] };
function cleanText(value, max) { return String(value || "").trim().slice(0, max); }
function normalizeWorkerProfile(input) {
  const experienceYears = Number(input.experienceYears || 0);
  if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 60) throw new Error("Ish stajini 0–60 yil oralig‘ida kiriting");
  const phone = String(input.phone||"").split(",").map(value=>cleanText(value,24)).filter(Boolean).slice(0,3); if (phone.some(value=>!/^\+?[0-9 ()-]{7,24}$/.test(value))) throw new Error("Telefon raqamini tekshiring"); const phoneValue=phone.join(",");
  const telegramUsername = cleanText(input.telegramUsername, 32).replace(/^@/, "");
  if (telegramUsername && !/^[A-Za-z0-9_]{5,32}$/.test(telegramUsername)) throw new Error("Telegram username noto‘g‘ri");
  const photoUrl = cleanText(input.photoUrl, 500);
  if (photoUrl) { const localUpload=/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(photoUrl); if (!localUpload) { let photo; try { photo = new URL(photoUrl); } catch { throw new Error("Profil rasmi yuklanmadi. Kamera yoki galereyadan qayta tanlang"); } if (photo.protocol !== "https:") throw new Error("Profil rasmi yuklanmadi. Kamera yoki galereyadan qayta tanlang"); } }
  return { experienceYears, phone: phoneValue, serviceRegion: cleanText(input.serviceRegion, 80), serviceCity: cleanText(input.serviceCity, 80), serviceDistrict: cleanText(input.serviceDistrict, 80), telegramUsername, photoUrl, servicePrices: cleanText(input.servicePrices, 1200), description: cleanText(input.description, 500), isPublic: input.isPublic !== false && input.isPublic !== 0 };
}
async function saveWorkerProfile(userId, profile) {
  await db.transaction(async () => {
  await db.run("INSERT INTO worker_profiles(user_id, experience_years, phone, service_region, service_city, service_district, telegram_username, photo_url, service_prices, description, is_public, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET experience_years = excluded.experience_years, phone = excluded.phone, service_region = excluded.service_region, service_city = excluded.service_city, service_district = excluded.service_district, telegram_username = excluded.telegram_username, photo_url = excluded.photo_url, service_prices = excluded.service_prices, description = excluded.description, is_public = excluded.is_public, updated_at = CURRENT_TIMESTAMP", userId, profile.experienceYears, profile.phone, profile.serviceRegion, profile.serviceCity, profile.serviceDistrict, profile.telegramUsername, profile.photoUrl, profile.servicePrices, profile.description, profile.isPublic ? 1 : 0);
  await db.run("UPDATE users SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", profile.phone, userId);
  });
}

function normalizeContactPhone(value) {
  const phone=cleanText(value,30);
  if(!phone)return '';
  if(!/^\+?[0-9 ()-]+$/.test(phone))throw new Error("Aloqa telefon raqamini tekshiring");
  let digits=phone.replace(/[^0-9]/g,'');
  if(digits.length===9)digits='998'+digits;
  if(!/^[1-9][0-9]{6,14}$/.test(digits))throw new Error("Aloqa telefon raqamini tekshiring");
  return '+'+digits;
}
async function normalizeHomeContent(input) {
  if (!input || typeof input !== "object") throw new Error("Kontent formati noto‘g‘ri");
  const hero = input.hero || {};
  const requestedProductId = Number(hero.productId);
  const requestedProduct = Number.isSafeInteger(requestedProductId)
    ? await db.get("SELECT id FROM products WHERE id = ? AND is_active = 1 AND deleted_at IS NULL", requestedProductId)
    : null;
  const fallbackProduct = requestedProduct || await db.get("SELECT id FROM products WHERE is_active = 1 AND deleted_at IS NULL ORDER BY id LIMIT 1");
  // An outdated/inactive promo product must not discard otherwise valid videos/news.
  const productId = fallbackProduct?.id ?? DEFAULT_HOME_CONTENT.hero.productId;
  const videos = (Array.isArray(input.videos) ? input.videos : []).slice(0, 6).map(item => {
    let url; try { url = new URL(String(item.url || "")); } catch { throw new Error("YouTube havolasini tekshiring"); }
    if (url.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(url.hostname)) throw new Error("Faqat YouTube havolasini kiriting");
    const videoId = url.hostname.includes("youtu.be") ? url.pathname.split("/").filter(Boolean)[0] : (url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]);
    if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) throw new Error("YouTube video manzili noto‘g‘ri");
    const category = ["CCTV", "Domofon", "ColorVu", "Boshqa"].includes(item.category) ? item.category : "Boshqa";
    return { title: cleanText(item.title, 100), url: url.href, description: cleanText(item.description, 220), category, active: item.active !== false };
  }).filter(item => item.title && item.url);
  const news = (Array.isArray(input.news) ? input.news : []).slice(0, 8).map(item => ({ title: cleanText(item.title, 100), body: cleanText(item.body, 500), active: item.active !== false })).filter(item => item.title && item.body);
  return { contactPhone: input.contactPhone === undefined ? DEFAULT_HOME_CONTENT.contactPhone : normalizeContactPhone(input.contactPhone), hero: { eyebrow: cleanText(hero.eyebrow, 70), title: cleanText(hero.title, 120), description: cleanText(hero.description, 240), productId, buttonText: cleanText(hero.buttonText, 40) || "Kameralarni ko‘rish" }, videos, news };
}
async function getHomeContent() {
  const row = await db.get("SELECT value FROM settings WHERE key = 'homepage_content'");
  if (!row) return DEFAULT_HOME_CONTENT;
  try { return await normalizeHomeContent(JSON.parse(row.value)); } catch { return DEFAULT_HOME_CONTENT; }
}

function sessionUser(user) { return { id: user.telegram_id, username: user.username || "", fullName: user.full_name || "", phone: user.phone || "", role: user.role }; }


function telegramWebhookSecret() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token ? createHmac("sha256", token).update("uzcam-telegram-webhook").digest("hex") : "";
}
async function telegramApi(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Telegram API ${method} failed`);
  return result.result;
}

function telegramAppUrl() {
  return (process.env.RENDER_EXTERNAL_URL || "https://texnocam-miniapp.onrender.com").replace(/\/$/, "") + "/";
}
function telegramMenuMarkup() {
  return {
    keyboard: [
      [{ text: "🛍 Katalog", web_app: { url: telegramAppUrl() } }],
      [{ text: "📷 EZVIZ kameralar" }, { text: "📹 Video tavsiyalar" }],
      [{ text: "📰 Yangiliklar" }, { text: "💬 Admin bilan aloqa" }],
      [{ text: "👷 Ustalar", web_app: { url: telegramAppUrl() + "#workers" } }]
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Menyudan tanlang"
  };
}
async function sendBotMenu(chatId, text) {
  await telegramApi("sendMessage", { chat_id: chatId, text, reply_markup: telegramMenuMarkup() });
}
function shortTelegramText(text, limit = 3900) {
  const value = String(text || "");
  return value.length > limit ? value.slice(0, limit - 24) + "\n…davomi katalogda" : value;
}
async function sendWorkerOffers(orderId) {
  const order=await db.get("SELECT o.id,o.order_number FROM orders o WHERE o.id=?",orderId);
  if(!order)return;
  const items=await db.all("SELECT p.name,oi.quantity FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?",orderId);
  const workers=await db.all("SELECT u.id,u.telegram_id FROM users u JOIN telegram_notification_preferences n ON n.user_id=u.id AND n.enabled=1 WHERE u.role='worker' AND u.is_active=1");
  const text="\u{1F527} Yangi xizmat buyurtmasi\n\nBuyurtma: "+order.order_number+"\nMahsulotlar: "+items.map(i=>i.name+"\u00d7"+i.quantity).join(', ')+"\n\nBirinchi qabul qilgan ustaga biriktiriladi.";
  for(const worker of workers){try{const sent=await telegramApi('sendMessage',{chat_id:worker.telegram_id,text,reply_markup:{inline_keyboard:[[ {text:'✅ Qabul qilish',callback_data:'claim:'+orderId} ]]}});await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?, 'offer_sent', 'worker_offer', ?, ?)",worker.id,String(orderId),JSON.stringify({chatId:worker.telegram_id,messageId:sent.message_id}));}catch(error){console.error('Worker offer failed:',error.message)}}
}
async function finalizeWorkerClaims() {
 const claims=await db.all("SELECT wc.order_id,wc.worker_id,o.order_number,o.customer_id,u.full_name,u.phone,u.username FROM work_claims wc JOIN orders o ON o.id=wc.order_id JOIN users u ON u.id=wc.worker_id WHERE wc.claimed_at <= ? AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.entity_type='work_claim' AND a.entity_id=CAST(wc.order_id AS TEXT) AND a.action='finalized')",new Date(Date.now()-10*60*1000).toISOString().slice(0,19).replace('T',' '));
 for(const claim of claims){await db.run("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,details_json) VALUES (?, 'finalized', 'work_claim', ?, '{}')",claim.worker_id,String(claim.order_id));await enqueueCustomerNotification(db,{userId:claim.customer_id,orderId:claim.order_id,eventKey:'order:'+claim.order_id+':worker-final',title:'Usta biriktirildi',message:'👷 Ustangiz biriktirildi.\nUsta: '+claim.full_name+'\nTelefon: '+(claim.phone||'—')+(claim.username?'\nTelegram: @'+claim.username:'')+'\nTez orada usta siz bilan bog‘lanadi.'});const offers=await db.all("SELECT actor_id,details_json FROM audit_log WHERE entity_type='worker_offer' AND entity_id=? AND action='offer_sent'",String(claim.order_id));for(const offer of offers){if(offer.actor_id===claim.worker_id)continue;try{const meta=JSON.parse(offer.details_json);await telegramApi('editMessageReplyMarkup',{chat_id:meta.chatId,message_id:meta.messageId,reply_markup:{inline_keyboard:[]}});await telegramApi('sendMessage',{chat_id:meta.chatId,text:'ℹ️ '+claim.order_number+' buyurtmaga boshqa usta biriktirildi.'});}catch{}}}
}

async function handleServiceCallback(callback){
 const match=String(callback.data||'').match(/^svc:(travelling|working|finish|star|confirm|problem|dispatch|review):(\d+)(?::([1-5]))?$/);
 if(!match)return;
 try{
  const actor=await db.get("SELECT id,role FROM users WHERE telegram_id=? AND is_active=1",String(callback.from.id));
  if(!actor)throw new Error('Profil topilmadi');
  const result=await serviceAction(db,actor,Number(match[2]),match[1],match[3]);
  await telegramApi('answerCallbackQuery',{callback_query_id:callback.id,text:result.showDispatcher?'Dispetcherga xabar berish tugmasini bosing':'Saqlandi'});
  if(result.showDispatcher)await telegramApi('editMessageReplyMarkup',{chat_id:callback.message.chat.id,message_id:callback.message.message_id,reply_markup:{inline_keyboard:[[{text:'Dispetcherga xabar berish',callback_data:'svc:dispatch:'+match[2]}],[{text:'Orqaga',callback_data:'svc:review:'+match[2]}]]}});
  else if(match[1]==='star'||match[1]==='review')await telegramApi('editMessageReplyMarkup',{chat_id:callback.message.chat.id,message_id:callback.message.message_id,reply_markup:reviewMarkup(Number(match[2]),result.selected_rating)});
  else await telegramApi('editMessageText',{chat_id:callback.message.chat.id,message_id:callback.message.message_id,text:result.order_number+' — '+({completed:'✅ Tasdiqlandi. Baho: '+result.rating+' ⭐',disputed:'⚠️ Dispetcherga xabar yuborildi. Ish ochiq qoladi.',travelling:'Yo‘lga chiqdingiz',working:'Ish boshlandi',awaiting_customer:'Mijoz tasdig‘i kutilmoqda'}[result.state]||result.state),reply_markup:{inline_keyboard:[]}});
 }catch(error){await telegramApi('answerCallbackQuery',{callback_query_id:callback.id,text:String(error.message||'Xatolik').slice(0,180),show_alert:true});}
}

async function handleWorkerCallback(callback) {
 const senderId=String(callback.from?.id||''),data=String(callback.data||''),match=data.match(/^(claim|cancel):(\d+)$/);if(!match)return;const worker=await db.get("SELECT id,telegram_id,role,is_active FROM users WHERE telegram_id=?",senderId);if(!worker||worker.role!=='worker'||!worker.is_active){await telegramApi('answerCallbackQuery',{callback_query_id:callback.id,text:'Sizda usta ruxsati yo‘q',show_alert:true});return}const orderId=Number(match[2]);if(match[1]==='claim'){const claimed=await db.transaction(async()=>{const order=await db.get("SELECT id,order_number,payment_status FROM orders WHERE id=?",orderId);if(!order||order.payment_status!=='confirmed')return null;const result=await db.run("INSERT INTO work_claims(order_id,worker_id,claimed_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(order_id) DO NOTHING",orderId,worker.id);return result.changes?order:null});if(!claimed){await telegramApi('answerCallbackQuery',{callback_query_id:callback.id,text:'Bu buyurtmani boshqa usta oldi',show_alert:true});return}const customer=await db.get("SELECT o.delivery_phone,o.delivery_address,u.full_name,u.username FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.id=?",orderId);const customerLink=customer.username?'@'+String(customer.username).replace(/^@/,''):'Telegram username kiritilmagan';await telegramApi('sendMessage',{chat_id:worker.telegram_id,text:'\u{1F4CB} '+claimed.order_number+' buyurtma tafsilotlari\nMijoz: '+(customer.full_name||'Mijoz')+'\nTelefon: '+customer.delivery_phone+'\nTelegram: '+customerLink+'\nManzil: '+customer.delivery_address});const offers=await db.all("SELECT actor_id,details_json FROM audit_log WHERE entity_type='worker_offer' AND entity_id=? AND action='offer_sent'",String(orderId));for(const offer of offers){if(offer.actor_id===worker.id)continue;try{const meta=JSON.parse(offer.details_json);await telegramApi('editMessageReplyMarkup',{chat_id:meta.chatId,message_id:meta.messageId,reply_markup:{inline_keyboard:[]}});await telegramApi('sendMessage',{chat_id:meta.chatId,text:'ℹ️ Bu buyurtma boshqa usta tomonidan vaqtincha qabul qilindi.'});}catch{}}await telegramApi('editMessageText',{chat_id:callback.message.chat.id,message_id:callback.message.message_id,text:'✅ '+claimed.order_number+' sizga vaqtincha biriktirildi. 10 daqiqa ichida bekor qilishingiz mumkin.',reply_markup:{inline_keyboard:[[ {text:'Bekor qilish (10 daqiqa)',callback_data:'cancel:'+orderId} ],[{text:'Usta kabinetini ochish',web_app:{url:telegramAppUrl()+'assets/worker-cabinet.html'}}] ]}});await telegramApi('answerCallbackQuery',{callback_query_id:callback.id,text:'Buyurtma sizga biriktirildi'});return}const started=await db.get("SELECT state FROM service_jobs WHERE order_id=?",orderId);if(started){await telegramApi("answerCallbackQuery",{callback_query_id:callback.id,text:"Ish boshlangan. Dispetcherga murojaat qiling",show_alert:true});return}const claim=await db.get("SELECT worker_id,claimed_at FROM work_claims WHERE order_id=?",orderId);if(!claim||claim.worker_id!==worker.id||Date.now()-new Date(String(claim.claimed_at).replace(' ','T')+'Z').getTime()>10*60*1000){await telegramApi('answerCallbackQuery',{callback_query_id:callback.id,text:'Bekor qilish muddati tugagan',show_alert:true});return}await db.run("DELETE FROM work_claims WHERE order_id=? AND worker_id=?",orderId,worker.id);await telegramApi('answerCallbackQuery',{callback_query_id:callback.id,text:'Buyurtma qayta tarqatildi'});await telegramApi('editMessageText',{chat_id:callback.message.chat.id,message_id:callback.message.message_id,text:'↩️ Buyurtma bekor qilindi va boshqa ustalarga qayta yuborildi.'});await sendWorkerOffers(orderId);
}
async function handleTelegramUpdate(update) {
  if(update.callback_query){if(String(update.callback_query.data||'').startsWith('svc:'))await handleServiceCallback(update.callback_query);else await handleWorkerCallback(update.callback_query);return;}
  const message = update.message;
  const chat = message && message.chat;
  if (!message || !chat || chat.type !== "private") return;
  const senderId = String(message.from && message.from.id || "");
  const superAdminId = String(process.env.SUPER_ADMIN_TELEGRAM_ID || "");
  const incomingText = String(message.text || "").trim();
  const match = incomingText.match(/^\/(start|help|menu|catalog|camera|videos|news|workers|support|stop)(?:@\w+)?(?:\s|$)/i);
  const command = match ? match[1].toLowerCase() : "";

  if (superAdminId && senderId === superAdminId && message.reply_to_message && message.reply_to_message.message_id) {
    const link = await db.get("SELECT customer_telegram_id FROM support_message_links WHERE admin_message_id = ?", message.reply_to_message.message_id);
    if (link) {
      if (command === "stop" || incomingText.toLowerCase() === "/close") {
        await db.run("UPDATE support_threads SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE customer_telegram_id = ?", link.customer_telegram_id);
        await telegramApi("sendMessage", { chat_id: link.customer_telegram_id, text: "Admin bilan suhbat yakunlandi. Yana yozish uchun ‘💬 Admin bilan aloqa’ tugmasini bosing." });
        await telegramApi("sendMessage", { chat_id: chat.id, text: "Suhbat yopildi." });
        return;
      }
      await telegramApi("copyMessage", { chat_id: link.customer_telegram_id, from_chat_id: chat.id, message_id: message.message_id });
      await telegramApi("sendMessage", { chat_id: chat.id, text: "Javob mijozga yuborildi." });
      return;
    }
  }

  if (command === "start" || command === "menu") {
    const firstName = String(message.from && message.from.first_name || "").trim();
    if (command === "start") {
      const customerName = [firstName, String(message.from && message.from.last_name || "").trim()].filter(Boolean).join(" ");
      const username = String(message.from && message.from.username || "").trim();
      await db.run(
        "INSERT INTO users(telegram_id, username, full_name, role) VALUES (?, ?, ?, 'customer') ON CONFLICT(telegram_id) DO UPDATE SET username = COALESCE(excluded.username, users.username), full_name = CASE WHEN excluded.full_name <> '' THEN excluded.full_name ELSE users.full_name END, updated_at = CURRENT_TIMESTAMP",
        senderId, username || null, customerName
      );
      const customer = await db.get("SELECT id FROM users WHERE telegram_id = ?", senderId);
      await db.run(
        "INSERT INTO telegram_notification_preferences(user_id, enabled, bot_started_at, updated_at) VALUES (?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET enabled = 1, bot_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP",
        customer.id
      );
    }
    await sendBotMenu(chat.id, "Assalomu alaykum" + (firstName ? ", " + firstName : "") + "! UzCam botiga xush kelibsiz. " + (command === "start" ? "Buyurtma holati va to‘lov bo‘yicha shaxsiy xabarnomalar yoqildi. " : "") + "Katalogni oching yoki kerakli bo‘limni tanlang.");
    return;
  }
  if (command === "help") {
    await sendBotMenu(chat.id, "Kerakli bo‘limni pastdagi menyudan tanlang. Buyurtma katalog ichida rasmiylashtiriladi. Admin bilan bog‘lanish uchun ‘💬 Admin bilan aloqa’ tugmasini bosing.");
    return;
  }
  if (command === "catalog" || incomingText === "🛍 Katalog") {
    await telegramApi("sendMessage", { chat_id: chat.id, text: "Kameralar, kabellar va elektronika katalogini oching:", reply_markup: { inline_keyboard: [[{ text: "Katalogni ochish", web_app: { url: telegramAppUrl() } }]] } });
    return;
  }
  if (command === "camera" || incomingText === "📷 EZVIZ kameralar") {
    const content = await getHomeContent();
    const product = (await listPublicProducts()).find(item => item.id === content.hero.productId);
    const price = product ? new Intl.NumberFormat("uz-UZ").format(product.price_uzs) + " so‘m" : "Narx katalogda";
    const lines = [content.hero.eyebrow, content.hero.title, content.hero.description, product ? product.brand + " " + product.name + " · " + price : "", "Katalogni ochib mavjud kameralarni ko‘ring."].filter(Boolean);
    await telegramApi("sendMessage", { chat_id: chat.id, text: shortTelegramText(lines.join("\n")), reply_markup: { inline_keyboard: [[{ text: "Kameralarni ko‘rish", web_app: { url: telegramAppUrl() } }]] } });
    return;
  }
  if (command === "videos" || incomingText === "📹 Video tavsiyalar") {
    const videos = (await getHomeContent()).videos.filter(item => item.active);
    const text = videos.length ? "📹 Video tavsiyalar\n\n" + videos.map((item, index) => (index + 1) + ". " + item.title + (item.description ? "\n" + item.description : "") + "\n" + item.url).join("\n\n") : "Hozircha video tavsiyalar joylanmagan. Yangilari qo‘shilganda shu bo‘limda ko‘rinadi.";
    await sendBotMenu(chat.id, shortTelegramText(text));
    return;
  }
  if (command === "news" || incomingText === "📰 Yangiliklar") {
    const news = (await getHomeContent()).news.filter(item => item.active);
    const text = news.length ? "📰 UzCam yangiliklari\n\n" + news.map((item, index) => (index + 1) + ". " + item.title + "\n" + item.body).join("\n\n") : "Hozircha yangi e’lon yo‘q. Yangiliklar qo‘shilganda shu bo‘limda ko‘rinadi.";
    await sendBotMenu(chat.id, shortTelegramText(text));
    return;
  }
  if (command === "workers" || incomingText === "👷 Ustalar") {
    await telegramApi("sendMessage", { chat_id: chat.id, text: "Hududingizdagi ustalarni ko‘rish uchun katalogni oching:", reply_markup: { inline_keyboard: [[{ text: "Ustalar katalogini ochish", web_app: { url: telegramAppUrl() + "#workers" } }]] } });
    return;
  }
  if (command === "support" || incomingText === "💬 Admin bilan aloqa") {
    if (!superAdminId) {
      await sendBotMenu(chat.id, "Admin bilan aloqa hozir sozlanmagan. Iltimos, keyinroq urinib ko‘ring.");
      return;
    }
    await db.run("INSERT INTO support_threads(customer_telegram_id, is_active, updated_at) VALUES (?, 1, CURRENT_TIMESTAMP) ON CONFLICT(customer_telegram_id) DO UPDATE SET is_active = 1, updated_at = CURRENT_TIMESTAMP", senderId);
    await sendBotMenu(chat.id, "Admin bilan suhbat boshlandi. Xabaringizni shu yerga yozing. Suhbatni tugatish uchun /stop yuboring.");
    await telegramApi("sendMessage", { chat_id: superAdminId, text: "💬 Yangi mijoz murojaati\nIsm: " + [message.from && message.from.first_name, message.from && message.from.last_name].filter(Boolean).join(" ") + "\nUsername: " + (message.from && message.from.username ? "@" + message.from.username : "yo‘q") + "\nTelegram ID: " + senderId + "\nMijoz xabariga javob berish uchun uning yuborgan nusxasiga Reply qiling." });
    return;
  }
  if (command === "stop") {
    await db.run("UPDATE support_threads SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE customer_telegram_id = ?", senderId);
    await sendBotMenu(chat.id, "Admin bilan suhbat yakunlandi. Yana bog‘lanish uchun menyudan aloqa tugmasini bosing.");
    return;
  }

  const activeThread = await db.get("SELECT is_active FROM support_threads WHERE customer_telegram_id = ?", senderId);
  if (activeThread && activeThread.is_active && superAdminId) {
    try {
      await telegramApi("sendMessage", { chat_id: superAdminId, text: "📩 Mijoz xabari\nIsm: " + [message.from && message.from.first_name, message.from && message.from.last_name].filter(Boolean).join(" ") + "\nUsername: " + (message.from && message.from.username ? "@" + message.from.username : "yo‘q") + "\nTelegram ID: " + senderId + "\nQuyidagi xabarga Reply qilib javob yuboring." });
      const copied = await telegramApi("copyMessage", { chat_id: superAdminId, from_chat_id: chat.id, message_id: message.message_id });
      await db.run("INSERT INTO support_message_links(admin_message_id, customer_telegram_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(admin_message_id) DO UPDATE SET customer_telegram_id=excluded.customer_telegram_id, created_at=CURRENT_TIMESTAMP", copied.message_id, senderId);
      await sendBotMenu(chat.id, "Xabaringiz adminga yetkazildi. Javobni shu bot orqali olasiz.");
    } catch (error) {
      console.error("Telegram support relay failed:", error.message);
      await sendBotMenu(chat.id, "Xabarni adminga yuborib bo‘lmadi. Iltimos, qayta urinib ko‘ring.");
    }
    return;
  }
  await sendBotMenu(chat.id, "Assalomu alaykum! Sizga qanday yordam beray? Katalog, kamera tavsiyasi, videolar yoki yangiliklar uchun pastdagi menyudan tanlang. Admin bilan gaplashish uchun ‘💬 Admin bilan aloqa’ tugmasini bosing.");
}

async function configureTelegramWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const publicUrl = process.env.RENDER_EXTERNAL_URL;
  if (!token || !publicUrl) return;
  try {
    await telegramApi("setWebhook", { url: `${publicUrl.replace(/\/$/, "")}/telegram/webhook`, secret_token: telegramWebhookSecret(), allowed_updates: ["message","callback_query"] });
    await telegramApi("setMyCommands", { commands: [{ command: "start", description: "UzCam bosh menyusi" }, { command: "catalog", description: "Mahsulotlar katalogi" }, { command: "camera", description: "EZVIZ kameralar" }, { command: "videos", description: "Video tavsiyalar" }, { command: "news", description: "Yangiliklar" }, { command: "workers", description: "Ustalar katalogi" }, { command: "support", description: "Admin bilan aloqa" }, { command: "stop", description: "Suhbatni yakunlash" }, { command: "help", description: "Yordam" }] });
    console.info("Telegram webhook configured");
  } catch (error) { console.error("Telegram webhook setup failed:", error.message); }
}

async function handleRequest(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400).end("Bad request"); return; }
  if (pathname.includes("\0")) { res.writeHead(400).end("Bad request"); return; }


  if (pathname === "/telegram/webhook") {
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    const expected = Buffer.from(telegramWebhookSecret());
    const supplied = Buffer.from(String(req.headers["x-telegram-bot-api-secret-token"] || ""));
    if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) { res.writeHead(401).end(); return; }
    try {
      const update = await readJson(req);
      await handleTelegramUpdate(update);
      sendJson(res, 200, { ok: true }); return;
    } catch (error) { console.error("Telegram webhook update failed:", error.message); sendJson(res, 500, { error: "Update handling failed" }); return; }
  }

  if (pathname.startsWith("/api/")) {


    if (pathname === "/api/catalog-brands" && req.method === "GET") {
      sendJson(res, 200, { brands: await listCatalogBrands(db) }); return;
    }
    const brandMatch = pathname.match(/^\/api\/admin\/brands\/([a-z0-9-]{1,64})$/);
    if (pathname === "/api/admin/brands" || brandMatch) {
      const actor = await getAdminSession(req);
      if (!actor || actor.role !== "super_admin") { sendJson(res, 403, { error: "Brendlarni faqat Super Admin boshqaradi" }); return; }
      try {
        if (!brandMatch && req.method === "GET") { sendJson(res, 200, { brands: await listCatalogBrands(db, true) }); return; }
        if ((!brandMatch && req.method === "POST") || (brandMatch && req.method === "PATCH")) {
          const brand = await saveCatalogBrand(db, actor, await readJson(req, 16000), brandMatch?.[1] || null, randomUUID());
          sendJson(res, brandMatch ? 200 : 201, { brand }); return;
        }
        if (brandMatch && req.method === "DELETE") {
          const brand = await deleteCatalogBrand(db, actor, brandMatch[1]);
          sendJson(res, 200, { brand }); return;
        }
        sendJson(res, 405, { error: "Usul qo‘llanmaydi" }); return;
      } catch (error) {
        sendJson(res, error.statusCode || (error instanceof SyntaxError ? 400 : 500), { error: error.statusCode ? error.message : "Brendni saqlab bo‘lmadi" }); return;
      }
    }

    if (pathname === "/api/admin/categories") {
      const actor = await getAdminSession(req);
      if (!actor || actor.role !== "super_admin") { sendJson(res, 403, { error: "Faqat Super Admin kategoriyalarni boshqaradi" }); return; }
      try {
        if (req.method === "GET") { sendJson(res, 200, { categories: await listManagedCategories(db) }); return; }
        if (req.method === "POST") {
          const category = await createCatalogCategory(db, (await readJson(req)).name);
          await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'category', ?, ?)", actor.id, category.reactivated ? 'reactivate' : 'create', category.name, JSON.stringify(category));
          sendJson(res, category.created ? 201 : 200, { category }); return;
        }
        if (req.method === "DELETE") {
          const body = await readJson(req), category = await deactivateCatalogCategory(db, body.name, body.replacementCategory);
          await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'deactivate', 'category', ?, ?)", actor.id, category.name, JSON.stringify(category));
          sendJson(res, 200, { category }); return;
        }
        sendJson(res, 405, { error: "Usul qo‘llanmaydi" }); return;
      } catch (error) {
        sendJson(res, error.statusCode || (error instanceof SyntaxError ? 400 : 500), { error: error.statusCode ? error.message : error instanceof SyntaxError ? "So‘rov formati noto‘g‘ri" : "Kategoriyani saqlab bo‘lmadi", productCount: error.productCount }); return;
      }
    }

    const productMatch = pathname.match(/^\/api\/admin\/products\/(\d+)$/);
    if (pathname === "/api/admin/products" || productMatch || pathname === "/api/admin/product-images") {
      const actor=await getAdminSession(req);
      if (!actor || !["admin","super_admin"].includes(actor.role)) { sendJson(res,403,{error:"Admin ruxsati talab qilinadi"});return; }
      try {
        if (pathname === "/api/admin/product-images" && req.method === "POST") {
          const body=await readJson(req,4500000);
          if (typeof body.base64!=="string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.base64)) throw productError("Rasm faylini tanlang");
          const bytes=Buffer.from(body.base64,"base64");
          if (!bytes.length || bytes.length>3*1024*1024) throw productError("Rasm 3 MB dan oshmasin",413);
          const ext=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"png":bytes[0]===255&&bytes[1]===216&&bytes[2]===255?"jpg":bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"?"webp":null;
          if (!ext) throw productError("Faqat JPG, PNG va WEBP rasmlarini yuklang");
          const image=await saveProductImage(bytes,ext);
          sendJson(res,201,{image});return;
        }
        if (pathname === "/api/admin/products") {
          if(req.method==="GET"){sendJson(res,200,await listManagedProducts(actor,new URL(req.url,"http://localhost").searchParams));return;}
          if(req.method==="POST"){sendJson(res,201,{product:await saveManagedProduct(actor,await readJson(req,16000))});return;}
        } else if(productMatch) {
          const id=Number(productMatch[1]);if(!Number.isSafeInteger(id))throw productError("Mahsulot ID noto‘g‘ri");
          if(req.method==="GET"){sendJson(res,200,{product:await getManagedProduct(actor,id)});return;}
          if(req.method==="PUT"){sendJson(res,200,{product:await saveManagedProduct(actor,await readJson(req,16000),id)});return;}
          if(req.method==="PATCH"){sendJson(res,200,{product:await changeProductState(actor,id,await readJson(req))});return;}
          if(req.method==="DELETE"){sendJson(res,200,{product:await changeProductState(actor,id,{},true)});return;}
        }
        sendJson(res,405,{error:"Usul qo‘llanmaydi"});return;
      }catch(error){if(!error.statusCode && !(error instanceof SyntaxError))console.error("Product operation failed:",error.message);sendJson(res,error.statusCode||(error instanceof SyntaxError?400:500),{error:error.statusCode?error.message:error instanceof SyntaxError?"So‘rov formati noto‘g‘ri":"Amalni bajarib bo‘lmadi"});return;}
    }


    if(pathname==='/api/service/jobs' && req.method==='POST'){
      try {const body=await readJson(req),tg=verifyTelegramInitData(String(body.initData||''));
       if(!tg?.id){sendJson(res,401,{error:'Telegram orqali kiring'});return}
       const actor=await db.get("SELECT id,role FROM users WHERE telegram_id=? AND is_active=1",String(tg.id));
       if(!actor){sendJson(res,403,{error:'Profil topilmadi'});return}
       sendJson(res,200,{role:actor.role,jobs:await listServiceJobs(db,actor)});return;
      }catch(error){sendJson(res,error.statusCode||400,{error:error.message});return}
    }
    const serviceActionMatch=pathname.match(/^\/api\/service\/jobs\/(\d+)\/action$/);
    if(serviceActionMatch && req.method==='POST'){
      try{const body=await readJson(req),tg=verifyTelegramInitData(String(body.initData||''));
       if(!tg?.id){sendJson(res,401,{error:'Telegram orqali kiring'});return}
       const actor=await db.get("SELECT id,role FROM users WHERE telegram_id=? AND is_active=1",String(tg.id));
       if(!actor){sendJson(res,403,{error:'Profil topilmadi'});return}
       sendJson(res,200,{ok:true,job:await serviceAction(db,actor,Number(serviceActionMatch[1]),body.action,body.rating)});return;
      }catch(error){sendJson(res,error.statusCode||400,{error:error.message});return}
    }
    if (pathname === "/api/workers" && req.method === "GET") {
      const workers = await db.all("SELECT u.telegram_id, u.full_name, wp.experience_years, wp.phone, wp.service_region, wp.service_city, wp.service_district, wp.telegram_username, wp.photo_url, wp.service_prices, wp.description, COALESCE(r.rating_average, 0) AS rating_average, COALESCE(r.rating_count, 0) AS rating_count FROM worker_profiles wp JOIN users u ON u.id = wp.user_id LEFT JOIN (SELECT worker_id, ROUND(AVG(rating), 1) AS rating_average, COUNT(*) AS rating_count FROM (SELECT worker_id,rating FROM worker_ratings UNION ALL SELECT worker_id,rating FROM service_jobs WHERE state='completed' AND rating IS NOT NULL) all_ratings GROUP BY worker_id) r ON r.worker_id = wp.user_id WHERE u.role = 'worker' AND u.is_active = 1 AND wp.is_public = 1 ORDER BY u.full_name");
      sendJson(res, 200, { workers }); return;
    }
    const workerRatingMatch = pathname.match(/^\/api\/workers\/(\d{5,20})\/rating$/);
    if (workerRatingMatch && req.method === "POST") {
      const body = await readJson(req);
      const customer = verifyTelegramInitData(String(body.initData || ""));
      const customerTelegramId = String(customer?.id || "");
      if (!/^\d{5,20}$/.test(customerTelegramId)) { sendJson(res, 401, { error: "Baho berish uchun Telegram Mini App orqali kiring" }); return; }
      sendJson(res,409,{error:"Bahoni buyurtma yakunlanganda tasdiqlash orqali bering"});return;
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) { sendJson(res, 400, { error: "Baho 1 dan 5 yulduzgacha bo‘lishi kerak" }); return; }
      const worker = await db.get("SELECT u.id, u.telegram_id FROM users u JOIN worker_profiles wp ON wp.user_id = u.id WHERE u.telegram_id = ? AND u.role = 'worker' AND u.is_active = 1 AND wp.is_public = 1", workerRatingMatch[1]);
      if (!worker) { sendJson(res, 404, { error: "Ochiq usta profili topilmadi" }); return; }
      if (customerTelegramId === String(worker.telegram_id)) { sendJson(res, 403, { error: "Usta o‘ziga baho bera olmaydi" }); return; }
      await db.run("INSERT INTO worker_ratings(worker_id, customer_telegram_id, rating) VALUES (?, ?, ?) ON CONFLICT(worker_id, customer_telegram_id) DO UPDATE SET rating = excluded.rating, updated_at = CURRENT_TIMESTAMP", worker.id, customerTelegramId, rating);
      const summary = await db.get("SELECT ROUND(AVG(rating), 1) AS rating_average, COUNT(*) AS rating_count FROM worker_ratings WHERE worker_id = ?", worker.id);
      sendJson(res, 200, { ok: true, rating, rating_average: Number(summary.rating_average), rating_count: Number(summary.rating_count) }); return;
    }
    const workerProfileMatch = pathname.match(/^\/api\/workers\/(\d{5,20})$/);
    if (workerProfileMatch && req.method === "PUT") {
      const actor = await getAdminSession(req);
      if (!actor || actor.role !== "super_admin") { sendJson(res, 403, { error: "Faqat Super Admin ustalar profilini boshqaradi" }); return; }
      try {
        const telegramId = workerProfileMatch[1];
        const user = await db.get("SELECT id FROM users WHERE telegram_id = ? AND role = 'worker'", telegramId);
        if (!user) { sendJson(res, 404, { error: "Ishchi topilmadi" }); return; }
        const body = await readJson(req);
        const profile = normalizeWorkerProfile(body);
        const fullName = cleanText(body.fullName, 100), nextTelegramId = String(body.telegramId || telegramId).trim();
        if (!/^\d{5,20}$/.test(nextTelegramId)) { sendJson(res, 400, { error: "Telegram ID faqat raqamlardan iborat bo‘lsin" }); return; }
        if (!fullName) { sendJson(res, 400, { error: "Ustaning ism-familiyasini kiriting" }); return; }
        const requestedPublic = profile.isPublic;
        const profileComplete = true;
        await db.run("UPDATE users SET telegram_id = ?, full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", nextTelegramId, fullName, user.id);
        await saveWorkerProfile(user.id, profile);
        await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'update', 'worker_profile', ?, ?)", actor.id, telegramId, JSON.stringify({ isPublic: profile.isPublic, autoHidden: requestedPublic && !profileComplete }));
        const savedWorker = await db.get("SELECT telegram_id, full_name FROM users WHERE id = ?", user.id); sendJson(res, 200, { ok: true, worker: savedWorker, isPublic: profile.isPublic, autoHidden: requestedPublic && !profileComplete }); return;
      } catch (error) { const duplicate=String(error?.message||"").includes("users_telegram_id_key"); sendJson(res, 400, { error: duplicate ? "Bu Telegram ID boshqa foydalanuvchiga biriktirilgan. Boshqa ID kiriting yoki o‘sha profilni tahrirlang." : (error.message || "Usta profilini saqlab bo‘lmadi") }); return; }
    }
    const deleteWorkerMatch = pathname.match(/^\/api\/workers\/(\d{5,20})$/);
    if (deleteWorkerMatch && req.method === "DELETE") {
      const actor = await getAdminSession(req);
      if (!actor || actor.role !== "super_admin") { sendJson(res, 403, { error: "Faqat Super Admin ustani o‘chiradi" }); return; }
      try {
        const telegramId=deleteWorkerMatch[1];
        await db.transaction(async()=>{
          const worker=await db.get("SELECT u.id,wp.photo_url FROM users u LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE u.telegram_id=? AND u.role='worker'",telegramId);
          if(!worker)throw Object.assign(new Error("Usta topilmadi"),{statusCode:404});
          const activeService=await db.get("SELECT order_id FROM service_jobs WHERE worker_id=? AND state<>'completed' LIMIT 1",worker.id);
          if(activeService)throw Object.assign(new Error("Ustaning ochiq ishi bor. Avval dispetcher orqali hal qiling"),{statusCode:409});
          await db.run("DELETE FROM service_jobs WHERE worker_id=?",worker.id);
          await db.run("DELETE FROM work_claims WHERE worker_id=?",worker.id);
          await db.run("DELETE FROM worker_ratings WHERE worker_id=?",worker.id);
          await db.run("DELETE FROM customer_notifications WHERE user_id=?",worker.id);
          await db.run("DELETE FROM telegram_notification_preferences WHERE user_id=?",worker.id);
          await db.run("DELETE FROM audit_log WHERE actor_id=? OR (entity_type='worker_profile' AND entity_id=?)",worker.id,telegramId);
          await db.run("DELETE FROM worker_profiles WHERE user_id=?",worker.id);
          const image=String(worker.photo_url||"").match(/\/uploads\/([a-f0-9-]+\.(?:png|jpg|webp))/);
          if(image)await db.run("DELETE FROM product_image_files WHERE name=?",image[1]);
          await db.run("DELETE FROM users WHERE id=?",worker.id);
        });
        sendJson(res,200,{ok:true});return;
      }catch(error){sendJson(res,error.statusCode||400,{error:error.message||"Ustani o‘chirib bo‘lmadi"});return;}
    }
    if (pathname === "/api/staff") {
      const actor = await getAdminSession(req);
      if (!actor || actor.role !== "super_admin") { sendJson(res, 403, { error: "Faqat Super Admin xodimlarni boshqaradi" }); return; }
      if (req.method === "GET") {
        const staff = await db.all("SELECT u.telegram_id, u.username, u.full_name, u.role, u.is_active, u.created_at, COALESCE(wp.experience_years, 0) AS experience_years, COALESCE(wp.phone, u.phone, '') AS phone, COALESCE(wp.service_region, '') AS service_region, COALESCE(wp.service_city, '') AS service_city, COALESCE(wp.service_district, '') AS service_district, COALESCE(wp.telegram_username, '') AS telegram_username, COALESCE(wp.photo_url, '') AS photo_url, COALESCE(wp.service_prices, '') AS service_prices, COALESCE(wp.description, '') AS description, COALESCE(wp.is_public, 1) AS is_public FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id WHERE u.role IN ('super_admin','admin','worker') ORDER BY CASE u.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.full_name, u.telegram_id");
        sendJson(res, 200, { staff }); return;
      }
      if (req.method === "POST") {
        try {
          const body = await readJson(req);
          const telegramId = String(body.telegramId || "").trim();
          const fullName = cleanText(body.fullName, 100);
          const role = String(body.role || "");
          if (!/^\d{5,20}$/.test(telegramId)) { sendJson(res, 400, { error: "Telegram ID faqat raqamlardan iborat bo‘lsin" }); return; }
          if (!["admin", "worker"].includes(role)) { sendJson(res, 400, { error: "Rolni Admin yoki Ishchi qilib tanlang" }); return; }
          const workerProfile = role === "worker" ? normalizeWorkerProfile(body) : null;
          const requestedPublic = Boolean(workerProfile?.isPublic);
          const profileComplete = true;
          if (telegramId === String(process.env.SUPER_ADMIN_TELEGRAM_ID || "")) { sendJson(res, 409, { error: "Super Admin akkauntini bu yerdan o‘zgartirib bo‘lmaydi" }); return; }
          const existingStaff = await db.get("SELECT role FROM users WHERE telegram_id = ?", telegramId);
          if (existingStaff && existingStaff.role === "super_admin") { sendJson(res, 409, { error: "Boshqa Super Admin akkauntini bu yerdan o‘zgartirib bo‘lmaydi" }); return; }
          await db.run("INSERT INTO users(telegram_id, full_name, role) VALUES (?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET full_name = CASE WHEN excluded.full_name <> '' THEN excluded.full_name ELSE users.full_name END, role = excluded.role, is_active = 1, updated_at = CURRENT_TIMESTAMP", telegramId, fullName, role);
          const user = await db.get("SELECT id, telegram_id, username, full_name, role, is_active, created_at FROM users WHERE telegram_id = ?", telegramId);
          if (role === "worker") await saveWorkerProfile(user.id, workerProfile);
          await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'create_or_promote', 'staff', ?, ?)", actor.id, telegramId, JSON.stringify({ role }));
          sendJson(res, 201, { staff: user, isPublic: workerProfile?.isPublic ?? false, autoHidden: requestedPublic && !profileComplete }); return;
        } catch (error) { sendJson(res, 400, { error: error.message || "Xodimni qo‘shib bo‘lmadi" }); return; }
      }
      res.writeHead(405).end(); return;
    }
    const staffMatch = pathname.match(/^\/api\/staff\/(\d{5,20})$/);
    if (staffMatch && req.method === "PATCH") {
      const actor = await getAdminSession(req);
      if (!actor || actor.role !== "super_admin") { sendJson(res, 403, { error: "Faqat Super Admin xodimlar ruxsatini o‘zgartiradi" }); return; }
      const telegramId = staffMatch[1];
      if (telegramId === String(process.env.SUPER_ADMIN_TELEGRAM_ID || "")) { sendJson(res, 409, { error: "Super Admin akkauntini o‘zgartirib bo‘lmaydi" }); return; }
      try {
        const body = await readJson(req);
        const current = await db.get("SELECT id, role, is_active FROM users WHERE telegram_id = ?", telegramId);
        if (!current || !["admin", "worker"].includes(current.role)) { sendJson(res, 404, { error: "Xodim topilmadi" }); return; }
        const role = body.role === undefined ? current.role : String(body.role);
        const isActive = body.isActive === undefined ? current.is_active : (body.isActive === true || body.isActive === 1 ? 1 : body.isActive === false || body.isActive === 0 ? 0 : -1);
        if (!["admin", "worker"].includes(role) || ![0, 1].includes(isActive)) { sendJson(res, 400, { error: "Rol yoki faol holat noto‘g‘ri" }); return; }
        await db.run("UPDATE users SET role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?", role, isActive, telegramId);
        if (role === "worker") await db.run("INSERT OR IGNORE INTO worker_profiles(user_id) VALUES (?)", current.id);
        await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'update', 'staff', ?, ?)", actor.id, telegramId, JSON.stringify({ role, isActive }));
        const staff = await db.get("SELECT telegram_id, username, full_name, role, is_active, created_at FROM users WHERE telegram_id = ?", telegramId);
        sendJson(res, 200, { staff }); return;
      } catch (error) { sendJson(res, 400, { error: error.message || "Xodim ruxsatini yangilab bo‘lmadi" }); return; }
    }
    if (pathname === "/api/admin/orders" && req.method === "GET") {
      const actor = await getAdminSession(req);
      if (!actor || !["admin", "super_admin"].includes(actor.role)) { sendJson(res, 403, { error: "Admin ruxsati talab qilinadi" }); return; }
      const rows = await db.all("SELECT o.id, o.order_number, o.status, o.payment_status, o.delivery_method, o.recipient_name, o.delivery_phone, o.delivery_address, o.total_uzs, o.created_at, u.full_name, u.telegram_id, u.username, p.status AS payment_record_status FROM orders o JOIN users u ON u.id = o.customer_id LEFT JOIN payments p ON p.order_id = o.id ORDER BY o.created_at DESC, o.id DESC LIMIT 100");
      const orders = [];
      for (const order of rows) {
        const items = await db.all("SELECT model_snapshot AS model, name_snapshot AS name, quantity, unit_price_uzs, line_total_uzs FROM order_items WHERE order_id = ? ORDER BY id", order.id);
        orders.push({ ...order, items });
      }
      sendJson(res, 200, { orders }); return;
    }
    if (pathname === "/api/admin/dashboard" && req.method === "GET") {
      const actor = await getAdminSession(req);
      if (!actor || !["admin", "super_admin"].includes(actor.role)) { sendJson(res, 403, { error: "Admin ruxsati talab qilinadi" }); return; }
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const todayStart = start.toISOString().slice(0, 19).replace("T", " ");
      const summary = await db.get(`SELECT
        (SELECT COUNT(*) FROM products WHERE is_active = 1 AND deleted_at IS NULL) AS active_products,
        (SELECT COUNT(*) FROM users WHERE role = 'customer' AND is_active = 1) AS active_customers,
        (SELECT COUNT(*) FROM users WHERE role = 'worker' AND is_active = 1) AS active_workers,
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT COUNT(*) FROM orders WHERE payment_status IN ('pending', 'proof_submitted')) AS awaiting_payment,
        (SELECT COUNT(*) FROM orders WHERE created_at >= ?) AS today_orders,
        (SELECT COALESCE(SUM(total_uzs), 0) FROM orders WHERE payment_status = 'confirmed' AND updated_at >= ?) AS today_confirmed_revenue`, todayStart, todayStart);
      const recentOrders = await db.all(`SELECT o.order_number, o.status, o.payment_status, o.total_uzs, o.created_at, u.full_name AS customer_name
        FROM orders o JOIN users u ON u.id = o.customer_id
        ORDER BY o.created_at DESC, o.id DESC LIMIT 5`);
      sendJson(res, 200, { summary: {
        activeProducts: Number(summary.active_products || 0),
        activeCustomers: Number(summary.active_customers || 0),
        activeWorkers: Number(summary.active_workers || 0),
        totalOrders: Number(summary.total_orders || 0),
        awaitingPayment: Number(summary.awaiting_payment || 0),
        todayOrders: Number(summary.today_orders || 0),
        todayConfirmedRevenue: Number(summary.today_confirmed_revenue || 0)
      }, recentOrders });
      return;
    }
    const orderStatusMatch = pathname.match(/^\/api\/admin\/orders\/(\d+)\/status$/);
    if (orderStatusMatch && req.method === "PATCH") {
      const actor = await getAdminSession(req);
      if (!actor || !["admin", "super_admin"].includes(actor.role)) { sendJson(res, 403, { error: "Admin ruxsati talab qilinadi" }); return; }
      try {
        const orderId = Number(orderStatusMatch[1]), body = await readJson(req);
        const nextStatus = String(body.status || "");
        const statusLabels = { pending_payment: "To‘lov kutilmoqda", paid: "To‘lov tasdiqlandi", assigned: "Ustaga biriktirildi", in_service: "Xizmat bajarilmoqda", completed: "Buyurtma yakunlandi", cancelled: "Buyurtma bekor qilindi" };
        if (!Number.isSafeInteger(orderId) || orderId <= 0 || !Object.hasOwn(statusLabels, nextStatus)) { sendJson(res, 400, { error: "Buyurtma holatini to‘g‘ri tanlang" }); return; }
        const order = await db.transaction(async () => {
          const current = await db.get("SELECT id, order_number, status, payment_status, customer_id FROM orders WHERE id = ?", orderId);
          if (!current) throw Object.assign(new Error("Buyurtma topilmadi"), { statusCode: 404 });
          if(nextStatus==='completed' && await db.get("SELECT order_id FROM work_claims WHERE order_id=?",orderId)){
            const service=await db.get("SELECT state FROM service_jobs WHERE order_id=?",orderId);
            if(service?.state!=='completed')throw Object.assign(new Error("Usta ishini faqat mijoz baholab tasdiqlagandan keyin yakunlash mumkin"),{statusCode:409});
          }
          if (current.status === nextStatus) return { ...current, changed: false };
          if (nextStatus !== "pending_payment" && nextStatus !== "cancelled" && current.payment_status !== "confirmed") {
            throw Object.assign(new Error("To‘lov tasdiqlanmaguncha buyurtmani bu bosqichga o‘tkazib bo‘lmaydi"), { statusCode: 409 });
          }
          await db.run("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", nextStatus, orderId);
          await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'change_status', 'order', ?, ?)", actor.id, current.order_number, JSON.stringify({ from: current.status, to: nextStatus }));
          const message = "📦 " + current.order_number + " buyurtmangiz holati yangilandi: " + statusLabels[nextStatus] + ".";
          await enqueueCustomerNotification(db, { userId: current.customer_id, orderId, eventKey: "order:" + orderId + ":status:" + randomUUID(), title: "Buyurtma holati yangilandi", message });
          return { ...current, status: nextStatus, changed: true };
        });
        sendJson(res, 200, { ok: true, orderNumber: order.order_number, status: order.status, changed: order.changed }); return;
      } catch (error) { sendJson(res, error.statusCode || 400, { error: error.message || "Buyurtma holatini saqlab bo‘lmadi" }); return; }
    }
    const orderPaymentMatch = pathname.match(/^\/api\/admin\/orders\/(\d+)\/payment$/);
    if (orderPaymentMatch && req.method === "PATCH") {
      const actor = await getAdminSession(req);
      if (!actor || !["admin", "super_admin"].includes(actor.role)) { sendJson(res, 403, { error: "Admin ruxsati talab qilinadi" }); return; }
      try {
        const orderId = Number(orderPaymentMatch[1]), body = await readJson(req);
        const paymentStatus = body.action === "confirm" ? "confirmed" : body.action === "reject" ? "rejected" : "";
        if (!Number.isSafeInteger(orderId) || orderId <= 0 || !paymentStatus) { sendJson(res, 400, { error: "To‘lov amalini tanlang" }); return; }
        const order = await db.transaction(async () => {
          const current = await db.get("SELECT id, order_number, payment_status, customer_id, customer_note FROM orders WHERE id = ?", orderId);
          if (!current) throw Object.assign(new Error("Buyurtma topilmadi"), { statusCode: 404 });
          if (current.payment_status === "confirmed") throw Object.assign(new Error("Bu buyurtma to‘lovi allaqachon tasdiqlangan"), { statusCode: 409 });
          if (!["pending", "proof_submitted", "rejected"].includes(current.payment_status)) throw Object.assign(new Error("Bu buyurtma holatini o‘zgartirib bo‘lmaydi"), { statusCode: 409 });
          await db.run("UPDATE orders SET payment_status = ?, status = CASE WHEN ? = 'confirmed' THEN 'paid' ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE id = ?", paymentStatus, paymentStatus, orderId);
          await db.run("UPDATE payments SET status = ?, confirmed_by = ?, confirmed_at = CASE WHEN ? = 'confirmed' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE order_id = ?", paymentStatus, paymentStatus === "confirmed" ? actor.id : null, paymentStatus, orderId);
          await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'order', ?, ?)", actor.id, paymentStatus === "confirmed" ? "confirm_payment" : "reject_payment", current.order_number, JSON.stringify({ paymentStatus }));
          const message = paymentStatus === "confirmed"
            ? "✅ " + current.order_number + " buyurtmangiz to‘lovi tasdiqlandi. UzCam jamoasi buyurtmangizni keyingi bosqichga o‘tkazadi."
            : "⚠️ " + current.order_number + " buyurtmangiz to‘lovi tasdiqlanmadi. Iltimos, to‘lov chekini tekshirib, admin bilan bog‘laning.";
          await enqueueCustomerNotification(db, { userId: current.customer_id, orderId, eventKey: "order:" + orderId + ":payment:" + paymentStatus, title: paymentStatus === "confirmed" ? "To‘lov tasdiqlandi" : "To‘lov rad etildi", message });
          if (paymentStatus === "confirmed" && current.status !== "paid") {
            await enqueueCustomerNotification(db, { userId: current.customer_id, orderId, eventKey: "order:" + orderId + ":status:" + randomUUID(), title: "Buyurtma qabul qilindi", message: "✅ " + current.order_number + " buyurtmangiz qabul qilindi va keyingi bosqichga o‘tkazildi." });
          }
          return { ...current, id: orderId, payment_status: paymentStatus };
        });
        if(order.payment_status==='confirmed' && String(order.customer_note||'').includes('service_preference=assign_worker')) void sendWorkerOffers(order.id); sendJson(res, 200, { ok: true, orderNumber: order.order_number, paymentStatus: order.payment_status }); return;
      } catch (error) { sendJson(res, error.statusCode || 400, { error: error.message || "To‘lov holatini saqlab bo‘lmadi" }); return; }
    }
    if (pathname === "/api/settings/pricing" && req.method === "GET") {
      const actor = await getAdminSession(req);
      if (!actor || actor.role !== "super_admin") { sendJson(res, 403, { error: "Faqat Super Admin ustama foizini boshqaradi" }); return; }
      const setting = await db.get("SELECT value, updated_at FROM settings WHERE key = ?", "markup_percent");
      sendJson(res, 200, { markupPercent: Number(setting?.value ?? 30), updatedAt: setting?.updated_at ?? null }); return;
    }
    if (pathname === "/api/settings/pricing" && req.method === "PUT") {
      const actor = await getAdminSession(req);
      if (!actor || actor.role !== "super_admin") { sendJson(res, 403, { error: "Faqat Super Admin ustama foizini boshqaradi" }); return; }
      try {
        const body = await readJson(req, 2000), { normalizeMarkupPercent } = await import("./backend/pricing.js");
        const markupPercent = normalizeMarkupPercent(body.markupPercent);
        await db.transaction(async () => {
          await db.run("INSERT INTO settings(key, value, updated_by, updated_at) VALUES ('markup_percent', ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP", String(markupPercent), actor.id);
          await db.run("UPDATE products SET sale_price_uzs = ROUND(source_price * rate_used * (1 + ? / 100.0)), updated_at = CURRENT_TIMESTAMP WHERE source_price > 0 AND rate_used > 0 AND deleted_at IS NULL", markupPercent);
          await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'update_markup', 'settings', 'markup_percent', ?)", actor.id, JSON.stringify({ markupPercent }));
        });
        sendJson(res, 200, { markupPercent }); return;
      } catch (error) { sendJson(res, error.statusCode || 400, { error: error.message || "Ustama foizini saqlab bo‘lmadi" }); return; }
    }
    if (pathname === "/api/analytics/events" && req.method === "POST") {
      try {
        const body = await readJson(req, 3000);
        const allowed = new Set(["page_view","product_view","search","add_to_cart","view_cart","begin_checkout","select_promotion","order_submitted","view_all_categories","open_brand_filter","open_price_filter","contact_phone_click"]);
        const action = String(body.name || "");
        if (!allowed.has(action)) { sendJson(res, 400, { error: "Analitika hodisasi noma’lum" }); return; }
        const input = body.properties && typeof body.properties === "object" ? body.properties : {}, safe = {};
        if (Number.isSafeInteger(Number(input.productId)) && Number(input.productId) > 0) safe.productId = Number(input.productId);
        if (input.query_length !== undefined && Number.isFinite(Number(input.query_length))) safe.query_length = Math.max(0, Math.min(200, Math.trunc(Number(input.query_length))));
        if (typeof input.category === "string") safe.category = input.category.slice(0, 60).replace(/[<>]/g, "");
        await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (NULL, ?, 'analytics', ?, ?)", action, safe.productId ? String(safe.productId) : null, JSON.stringify(safe));
        sendJson(res, 202, { ok: true }); return;
      } catch (error) { sendJson(res, error.statusCode || 400, { error: "Analitika hodisasi saqlanmadi" }); return; }
    }
    if (pathname === "/api/analytics/stats" && req.method === "GET") {
      const actor = await getAdminSession(req);
      if (!actor || actor.role !== "super_admin") { sendJson(res, 403, { error: "Analitikani faqat Super Admin ko‘ra oladi" }); return; }
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 19).replace("T", " ");
      const rows = await db.all("SELECT action, COUNT(*) AS total FROM audit_log WHERE entity_type = 'analytics' AND created_at >= ? GROUP BY action ORDER BY total DESC", since);
      const events = rows.map(row => ({ name: row.action, count: Number(row.total) }));
      sendJson(res, 200, { days: 30, total: events.reduce((sum, event) => sum + event.count, 0), events }); return;
    }
    if (pathname === "/api/public-config" && req.method === "GET") {
      sendJson(res, 200, { analytics: { ga4MeasurementId: process.env.GA4_MEASUREMENT_ID || "", clarityProjectId: process.env.CLARITY_PROJECT_ID || "", sentryBrowserDsn: process.env.SENTRY_BROWSER_DSN || "" } }); return;
    }
    if (pathname === "/api/customer/notifications" && req.method === "POST") {
      try {
        const body = await readJson(req, 9000);
        const telegramUser = verifyTelegramInitData(String(body.initData || ""));
        if (!telegramUser?.id) { sendJson(res, 401, { error: "Telegram profilini tasdiqlash talab qilinadi" }); return; }
        const customer = await db.get("SELECT id FROM users WHERE telegram_id = ? AND is_active = 1", String(telegramUser.id));
        if (!customer) { sendJson(res, 404, { error: "Mijoz profili topilmadi" }); return; }
        if (body.action === "read") await db.run("UPDATE customer_notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL", customer.id);
        const preference = await db.get("SELECT enabled, bot_started_at FROM telegram_notification_preferences WHERE user_id = ?", customer.id);
        const notifications = await db.all("SELECT id, order_id, title, message, delivery_status, sent_at, read_at, created_at FROM customer_notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50", customer.id);
        sendJson(res, 200, { notifications, botStarted: Boolean(preference?.enabled), botStartedAt: preference?.bot_started_at || null, unreadCount: notifications.filter(item => !item.read_at).length }); return;
      } catch (error) { sendJson(res, 400, { error: error.message || "Xabarnomalarni yuklab bo‘lmadi" }); return; }
    }

    if (pathname === "/api/customer/orders" && req.method === "POST") {
      try {
        const body = await readJson(req, 9000);
        const telegramUser = verifyTelegramInitData(String(body.initData || ""));
        if (!telegramUser?.id) { sendJson(res, 401, { error: "Telegram profilingizni tasdiqlash talab qilinadi" }); return; }
        const customer = await db.get("SELECT id FROM users WHERE telegram_id = ? AND is_active = 1", String(telegramUser.id));
        if (!customer) { sendJson(res, 404, { error: "Mijoz profili topilmadi" }); return; }
        const orders = await db.all(
          "SELECT id, order_number, status, payment_status, delivery_method, total_uzs, created_at, updated_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT 100",
          customer.id
        );
        const result = [];
        for (const order of orders) {
          const items = await db.all(
            "SELECT model_snapshot AS model, name_snapshot AS name, quantity, unit_price_uzs, line_total_uzs FROM order_items WHERE order_id = ? ORDER BY id",
            order.id
          );
          const events = await db.all(
            "SELECT action, details_json, created_at FROM audit_log WHERE entity_type = 'order' AND entity_id = ? ORDER BY created_at ASC, id ASC",
            order.order_number
          );
          const history = events.map(event => {
            let details = {};
            try { details = JSON.parse(event.details_json || "{}"); } catch {}
            if (event.action === "change_status") return {
              type: "status", from: details.from || "", to: details.to || "",
              at: event.created_at
            };
            if (event.action === "create") return { type: "created", at: event.created_at };
            if (event.action.includes("payment")) return { type: "payment", action: event.action, at: event.created_at };
            return null;
          }).filter(Boolean);
          const service=await db.get('SELECT state,rating FROM service_jobs WHERE order_id=?',order.id); result.push({ ...order, items, history, service });
        }
        sendJson(res, 200, { orders: result }); return;
      } catch (error) {
        sendJson(res, 400, { error: error.message || "Buyurtmalarni yuklab bo‘lmadi" }); return;
      }
    }

    if (pathname === "/api/orders" && req.method === "POST") {
      try {
        const body = await readJson(req, 16000), telegramUser = verifyTelegramInitData(body.initData);
        if (!telegramUser?.id) { sendJson(res, 401, { error: "Buyurtma berish uchun Telegram ichidan oching va profilni tasdiqlang" }); return; }
        const incoming = body.order;
        if (!incoming || !Array.isArray(incoming.items) || incoming.items.length < 1 || incoming.items.length > 50) { sendJson(res, 400, { error: "Savatchadagi mahsulotlarni tekshiring" }); return; }
        const deliveryMethod = incoming.deliveryMethod === "bts" ? "bts" : ["courier","address"].includes(incoming.deliveryMethod) ? "address" : "";
        const phone = cleanText(incoming.phone, 24), address = cleanText(incoming.address, 500), recipientName = cleanText(incoming.recipientName, 100), servicePreference = incoming.servicePreference === "assign_worker" ? "assign_worker" : "own_master";
        if (!deliveryMethod || !/^\+?[0-9 ()-]{7,24}$/.test(phone) || phone.replace(/\D/g, "").length < 7 || !address || (deliveryMethod === "bts" && !recipientName)) { sendJson(res, 400, { error: "Telefon, manzil va yetkazish ma’lumotlarini to‘ldiring" }); return; }
        const orderNumber = "UC-" + new Date().toISOString().slice(0,10).replaceAll("-","") + "-" + randomUUID().slice(0,8).toUpperCase();
        const superAdminId = String(process.env.SUPER_ADMIN_TELEGRAM_ID || "");
        const saved = await db.transaction(async () => {
          const telegramId = String(telegramUser.id), existing = await db.get("SELECT id, role, is_active FROM users WHERE telegram_id = ?", telegramId);
          if (existing && !existing.is_active) throw Object.assign(new Error("Ushbu foydalanuvchi faolsiz"), { statusCode: 403 });
          const role = superAdminId && telegramId === superAdminId ? "super_admin" : (existing?.role || "customer");
          const fullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ");
          await db.run("INSERT INTO users(telegram_id, username, full_name, role) VALUES (?, ?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username, full_name = excluded.full_name, role = CASE WHEN users.role = 'super_admin' OR excluded.role = 'super_admin' THEN 'super_admin' ELSE users.role END, updated_at = CURRENT_TIMESTAMP", telegramId, telegramUser.username || null, fullName, role);
          const customer = await db.get("SELECT id FROM users WHERE telegram_id = ?", telegramId);
          const orderItems = []; let subtotal = 0;
          for (const line of incoming.items) {
            const id = Number(line.id), quantity = Number(line.quantity);
            if (!Number.isSafeInteger(id) || id <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw Object.assign(new Error("Mahsulot miqdorini tekshiring"), { statusCode: 400 });
            const product = await db.get("SELECT id, model, name, sale_price_uzs AS price_uzs FROM products WHERE id = ? AND is_active = 1 AND deleted_at IS NULL", id);
            if (!product) throw Object.assign(new Error("Savatchadagi mahsulotlardan biri mavjud emas"), { statusCode: 409 });
            const lineTotal = Number(product.price_uzs) * quantity;
            if (!Number.isSafeInteger(lineTotal) || lineTotal < 0) throw Object.assign(new Error("Buyurtma summasi noto‘g‘ri"), { statusCode: 400 });
            subtotal += lineTotal; orderItems.push({ product, quantity, lineTotal });
          }
          if (!Number.isSafeInteger(subtotal) || subtotal <= 0 || subtotal > 1e12) throw Object.assign(new Error("Buyurtma summasi ruxsat etilgan chegaradan tashqarida"), { statusCode: 400 });
          await db.run("INSERT INTO orders(order_number, customer_id, status, payment_status, delivery_method, recipient_name, delivery_phone, delivery_address, delivery_fee_uzs, subtotal_uzs, total_uzs, customer_note) VALUES (?, ?, 'pending_payment', 'pending', ?, ?, ?, ?, 0, ?, ?, ?)", orderNumber, customer.id, deliveryMethod, recipientName, phone, address, subtotal, subtotal, "service_preference="+servicePreference);
          const order = await db.get("SELECT id FROM orders WHERE order_number = ?", orderNumber);
          for (const line of orderItems) await db.run("INSERT INTO order_items(order_id, product_id, model_snapshot, name_snapshot, quantity, unit_price_uzs, line_total_uzs) VALUES (?, ?, ?, ?, ?, ?, ?)", order.id, line.product.id, line.product.model, line.product.name, line.quantity, Number(line.product.price_uzs), line.lineTotal);
          await db.run("INSERT INTO payments(order_id, amount_uzs, method, status) VALUES (?, ?, 'qr', 'pending')", order.id, subtotal);
          await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'create', 'order', ?, ?)", customer.id, orderNumber, JSON.stringify({ itemCount: orderItems.length, totalUzs: subtotal, deliveryMethod }));
          await enqueueCustomerNotification(db, { userId: customer.id, orderId: order.id, eventKey: "order:" + order.id + ":created", title: "Buyurtma qabul qilindi", message: "🛒 " + orderNumber + " buyurtmangiz qabul qilindi. Jami: " + new Intl.NumberFormat("uz-UZ").format(subtotal) + " so‘m. To‘lov tasdig‘ini kutmoqda." });
          return { orderNumber, total: subtotal, itemCount: orderItems.length, items: orderItems.map(line => ({ name: line.product.name, model: line.product.model, quantity: line.quantity, total: line.lineTotal })), customerName: fullName || "Telegram mijoz", telegramId, phone, address, deliveryMethod };
        });
        if (superAdminId) {
          const itemLines = saved.items.map(item => "• " + item.model + " — " + item.name + " × " + item.quantity + " = " + new Intl.NumberFormat("uz-UZ").format(item.total) + " so‘m").join("\n");
          const note = "🛒 Yangi UzCam buyurtma: " + saved.orderNumber + "\nMijoz: " + saved.customerName + "\nTelegram ID: " + saved.telegramId + "\nTelefon: " + saved.phone + "\nYetkazish: " + (saved.deliveryMethod === "bts" ? "BTS" : "Manzilga") + "\nManzil: " + saved.address + "\nMahsulotlar:\n" + itemLines + "\nJami: " + new Intl.NumberFormat("uz-UZ").format(saved.total) + " so‘m\nHolat: to‘lov tasdig‘ini kutmoqda.";
          try { await telegramApi("sendMessage", { chat_id: superAdminId, text: note }); } catch (error) { console.error("Order notification failed:", error.message); }
        }
        sendJson(res, 201, { ok: true, orderNumber: saved.orderNumber, total: saved.total, message: "Buyurtma saqlandi. To‘lov admin tomonidan tekshiriladi." }); return;
      } catch (error) { sendJson(res, error.statusCode || 400, { error: error.message || "Buyurtmani saqlab bo‘lmadi" }); return; }
    }
    if (pathname === "/api/home-content" && req.method === "GET") { sendJson(res, 200, { content: await getHomeContent() }); return; }
    if (pathname === "/api/home-content" && req.method === "PUT") {
      const actor = await getAdminSession(req);
      if (!actor || !["admin", "super_admin"].includes(actor.role)) { sendJson(res, 403, { error: "Admin ruxsati talab qilinadi" }); return; }
      try {
        const body = await readJson(req);
        if(body.contactPhone===undefined)body.contactPhone=(await getHomeContent()).contactPhone;
        const content = await normalizeHomeContent(body);
        const value = JSON.stringify(content);
        await db.run("INSERT INTO settings(key, value, updated_by, updated_at) VALUES ('homepage_content', ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP", value, actor.id);
        await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'update', 'homepage_content', 'home', ?)", actor.id, JSON.stringify({ videos: content.videos.length, news: content.news.length, productId: content.hero.productId }));
        sendJson(res, 200, { content }); return;
      } catch (error) { sendJson(res, 400, { error: error.message || "Kontentni saqlab bo‘lmadi" }); return; }
    }
    if (pathname === "/api/session" && req.method === "POST") {
      try {
        const body = await readJson(req);
        const telegramUser = verifyTelegramInitData(body.initData);
        if (!telegramUser?.id) { sendJson(res, 401, { error: "Telegram tasdiqlashi yaroqsiz yoki eskirgan" }); return; }
        const telegramId = String(telegramUser.id);
        const existing = await db.get("SELECT role FROM users WHERE telegram_id = ?", telegramId);
        const superAdminId = process.env.SUPER_ADMIN_TELEGRAM_ID;
        const role = superAdminId && telegramId === String(superAdminId) ? "super_admin" : (existing?.role || "customer");
        const fullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ");
        await db.run("INSERT INTO users (telegram_id, username, full_name, role) VALUES (?, ?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username, full_name = excluded.full_name, role = CASE WHEN users.role = 'super_admin' OR excluded.role = 'super_admin' THEN 'super_admin' ELSE users.role END, updated_at = CURRENT_TIMESTAMP", telegramId, telegramUser.username || null, fullName, role);
        const user = await db.get("SELECT id, telegram_id, username, full_name, phone, role, is_active FROM users WHERE telegram_id = ?", telegramId);
        if (!user.is_active) { sendJson(res, 403, { error: "Ushbu foydalanuvchi faolsiz" }); return; }
        const payload = Buffer.from(JSON.stringify({ id: telegramId, exp: Date.now() + 2 * 60 * 60 * 1000 })).toString("base64url");
        const signature = createHmac("sha256", process.env.TELEGRAM_BOT_TOKEN).update(payload).digest("base64url");
        res.setHeader("Set-Cookie", `uzcam_session=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=7200`);
        sendJson(res, 200, { user: sessionUser(user) }); return;
      } catch { sendJson(res, 400, { error: "Profil so‘rovini o‘qib bo‘lmadi" }); return; }
    }
    if (pathname === "/api/session" && req.method === "GET") {
      const user = await getAdminSession(req);
      if (!user) { sendJson(res, 401, { error: "Admin sessiyasi topilmadi" }); return; }
      sendJson(res, 200, { user: sessionUser(user) }); return;
    }
    if (req.method !== "GET") { sendJson(res, 405, { error: "Method not allowed" }); return; }
    const reviewedPhoto = pathname.match(/^\/api\/reviewed-product-images\/(\d+)\/([a-f0-9]{12})$/);
    if (reviewedPhoto) {
      try {
        const image = await reviewedImages.load(reviewedPhoto[1], reviewedPhoto[2]);
        if (!image) { res.writeHead(404).end('Not found'); return; }
        const headers = { 'Content-Type': image.contentType, 'Cache-Control': 'public, max-age=86400', ETag: image.etag, 'X-Content-Type-Options': 'nosniff' };
        if (req.headers['if-none-match'] === image.etag) { res.writeHead(304, headers).end(); return; }
        res.writeHead(200, headers).end(image.bytes);
      } catch { res.writeHead(502, { 'Cache-Control': 'no-store' }).end('Image source unavailable'); }
      return;
    }
    if (pathname === "/api/health") {
       await db.get("SELECT 1 AS ready");
       const catalogStatus = await db.get("SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active = 1 AND deleted_at IS NULL) AS active, COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted FROM products");
       sendJson(res,200,{status:"ok",database:"connected",databaseEngine:db.kind,imageStorage:imageStorageMode(),backendStage:"catalog-management",catalog:{total:Number(catalogStatus.total)||0,active:Number(catalogStatus.active)||0,deleted:Number(catalogStatus.deleted)||0}});
       return;
     }
    if (pathname === "/api/products") {
       try {
         const products = await listPublicProducts();
         if (!products.length) {
           const catalogState = await db.get("SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 AND deleted_at IS NULL THEN 1 ELSE 0 END) AS active FROM products");
           console.error("Public catalog returned zero products:", JSON.stringify(catalogState));
         }
         let categories;
         try { categories = await listPublicCategories(); }
         catch (error) {
           console.error("Public catalog categories unavailable; deriving from products:", error.message);
           categories = [...new Set(products.map(product => product.category).filter(Boolean))].sort();
         }
         sendJson(res, 200, { products, categories });
       } catch (error) {
         console.error("Public catalog request failed:", error.message);
         sendJson(res, 500, { error: "Catalog unavailable" });
       }
       return;
     }
    sendJson(res, 404, { error: "API route not found" }); return;
  }

  if (pathname === "/admin-preview.html" && !await getAdminSession(req)) { res.writeHead(404, { "Content-Type":"text/plain; charset=utf-8" }).end("Not found"); return; }
  if (pathname === "/") pathname = "/index.html";
  let file;
  if (/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(pathname)) {
    const image=await loadProductImage(path.basename(pathname));
    if(!image){res.writeHead(404).end("Not found");return;}
    res.writeHead(200,{"Content-Type":image.contentType,"Cache-Control":"public, max-age=86400","X-Content-Type-Options":"nosniff"});res.end(image.bytes);return;
  }
  else if (pathname === "/index.html" || pathname === "/admin-preview.html" || pathname.startsWith("/assets/")) {
    file=path.resolve(root,"."+pathname);
    const allowedRoot=pathname.startsWith("/assets/")?path.join(root,"assets"):root;
    if (!file.startsWith(allowedRoot+path.sep)) { res.writeHead(403).end("Forbidden");return; }
  } else { res.writeHead(404).end("Not found");return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, { "Content-Type":"text/plain; charset=utf-8" }).end("Not found"); return; }
    res.writeHead(200, { "Content-Type":types[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control":pathname.startsWith("/assets/") ? "public, max-age=86400, stale-while-revalidate=604800" : "no-cache", "X-Content-Type-Options":"nosniff" });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req,res) => {
  handleRequest(req,res).catch(() => {
    console.error("Request failed: database or storage unavailable");
    if (!res.headersSent) sendJson(res,503,{error:"Xizmat vaqtincha mavjud emas. Qayta urinib ko‘ring."});
    else res.destroy();
  });
});

const port = Number(process.env.PORT || 3000);
try { await db.get("SELECT 1 AS ready"); await initializeImageStorage(); await initializeServiceWorkflow(db); await db.run("UPDATE customer_notifications SET delivery_status = 'pending' WHERE delivery_status = 'sending'"); }
catch (error) { console.error("Database/storage initialization failed; check environment configuration"); process.exit(1); }
server.listen(port, "0.0.0.0", () => { console.log(`UzCam backend running on port ${port}`); void configureTelegramWebhook(); });
const notificationTimer = setInterval(() => {
  void dispatchCustomerNotifications(db, telegramApi).catch(error => console.error("Customer notification queue failed:", error.message));
}, 15000);
notificationTimer.unref();
const workerClaimTimer=setInterval(()=>{void finalizeWorkerClaims().catch(error=>console.error('Worker claim finalizer failed:',error.message));},15000);
workerClaimTimer.unref();
for(const signal of ["SIGINT","SIGTERM"]) process.once(signal,()=>{server.close(()=>{void db.close().finally(()=>process.exit(0));});setTimeout(()=>process.exit(1),10000).unref();});
