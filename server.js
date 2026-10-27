import { initializeImageStorage, saveProductImage, loadProductImage, imageStorageMode } from "./backend/image-storage.js";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { listPublicProducts, listPublicCategories, db } from "./backend/database.js";
import { listManagedProducts, getManagedProduct, saveManagedProduct, changeProductState, productError } from "./backend/product-management.js";

const root = process.cwd();
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
  const phone = cleanText(input.phone, 24);
  if (phone && !/^\+?[0-9 ()-]{7,24}$/.test(phone)) throw new Error("Telefon raqamini tekshiring");
  const telegramUsername = cleanText(input.telegramUsername, 32).replace(/^@/, "");
  if (telegramUsername && !/^[A-Za-z0-9_]{5,32}$/.test(telegramUsername)) throw new Error("Telegram username noto‘g‘ri");
  const photoUrl = cleanText(input.photoUrl, 500);
  if (photoUrl) { let photo; try { photo = new URL(photoUrl); } catch { throw new Error("Rasm uchun HTTPS havolani kiriting"); } if (photo.protocol !== "https:") throw new Error("Rasm uchun HTTPS havolani kiriting"); }
  return { experienceYears, phone, telegramUsername, photoUrl, servicePrices: cleanText(input.servicePrices, 1200), description: cleanText(input.description, 500), isPublic: input.isPublic !== false && input.isPublic !== 0 };
}
async function saveWorkerProfile(userId, profile) {
  await db.transaction(async () => {
  await db.run("INSERT INTO worker_profiles(user_id, experience_years, phone, telegram_username, photo_url, service_prices, description, is_public, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET experience_years = excluded.experience_years, phone = excluded.phone, telegram_username = excluded.telegram_username, photo_url = excluded.photo_url, service_prices = excluded.service_prices, description = excluded.description, is_public = excluded.is_public, updated_at = CURRENT_TIMESTAMP", userId, profile.experienceYears, profile.phone, profile.telegramUsername, profile.photoUrl, profile.servicePrices, profile.description, profile.isPublic ? 1 : 0);
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
  const productId = Number(hero.productId);
  if (!Number.isSafeInteger(productId) || !await db.get("SELECT 1 FROM products WHERE id = ? AND is_active = 1 AND deleted_at IS NULL", productId)) throw new Error("Promo uchun faol mahsulot tanlang");
  const videos = (Array.isArray(input.videos) ? input.videos : []).slice(0, 6).map(item => {
    let url; try { url = new URL(String(item.url || "")); } catch { throw new Error("YouTube havolasini tekshiring"); }
    if (url.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(url.hostname)) throw new Error("Faqat YouTube havolasini kiriting");
    const videoId = url.hostname.includes("youtu.be") ? url.pathname.split("/").filter(Boolean)[0] : (url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]);
    if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) throw new Error("YouTube video manzili noto‘g‘ri");
    return { title: cleanText(item.title, 100), url: url.href, description: cleanText(item.description, 220), active: item.active !== false };
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
async function handleTelegramUpdate(update) {
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
    await sendBotMenu(chat.id, "Assalomu alaykum" + (firstName ? ", " + firstName : "") + "! UzCam botiga xush kelibsiz. Katalogni oching yoki kerakli bo‘limni tanlang.");
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
    await telegramApi("setWebhook", { url: `${publicUrl.replace(/\/$/, "")}/telegram/webhook`, secret_token: telegramWebhookSecret(), allowed_updates: ["message"] });
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

    if (pathname === "/api/workers" && req.method === "GET") {
      const workers = await db.all("SELECT u.telegram_id, u.full_name, wp.experience_years, wp.phone, wp.telegram_username, wp.photo_url, wp.service_prices, wp.description FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.role = 'worker' AND u.is_active = 1 AND wp.is_public = 1 ORDER BY u.full_name");
      sendJson(res, 200, { workers }); return;
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
        const fullName = cleanText(body.fullName, 100);
        if (!fullName) { sendJson(res, 400, { error: "Ustaning ism-familiyasini kiriting" }); return; }
        if (profile.isPublic && (!profile.phone || !profile.telegramUsername || !profile.photoUrl || !profile.servicePrices)) { sendJson(res, 400, { error: "Ommaga chiqarish uchun telefon, Telegram username, rasm havolasi va xizmat narxlarini to‘ldiring" }); return; }
        await db.run("UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", fullName, user.id);
        await saveWorkerProfile(user.id, profile);
        await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'update', 'worker_profile', ?, ?)", actor.id, telegramId, JSON.stringify({ isPublic: profile.isPublic }));
        sendJson(res, 200, { ok: true }); return;
      } catch (error) { sendJson(res, 400, { error: error.message || "Usta profilini saqlab bo‘lmadi" }); return; }
    }
    if (pathname === "/api/staff") {
      const actor = await getAdminSession(req);
      if (!actor || actor.role !== "super_admin") { sendJson(res, 403, { error: "Faqat Super Admin xodimlarni boshqaradi" }); return; }
      if (req.method === "GET") {
        const staff = await db.all("SELECT u.telegram_id, u.username, u.full_name, u.role, u.is_active, u.created_at, COALESCE(wp.experience_years, 0) AS experience_years, COALESCE(wp.phone, u.phone, '') AS phone, COALESCE(wp.telegram_username, '') AS telegram_username, COALESCE(wp.photo_url, '') AS photo_url, COALESCE(wp.service_prices, '') AS service_prices, COALESCE(wp.description, '') AS description, COALESCE(wp.is_public, 1) AS is_public FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id WHERE u.role IN ('super_admin','admin','worker') ORDER BY CASE u.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.full_name, u.telegram_id");
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
          if (workerProfile && workerProfile.isPublic && (!fullName || !workerProfile.phone || !workerProfile.telegramUsername || !workerProfile.photoUrl || !workerProfile.servicePrices)) { sendJson(res, 400, { error: "Ommaga chiqarish uchun ism-familiya, telefon, Telegram username, rasm havolasi va xizmat narxlarini to‘ldiring; aks holda profilni yashirin saqlang" }); return; }
          if (telegramId === String(process.env.SUPER_ADMIN_TELEGRAM_ID || "")) { sendJson(res, 409, { error: "Super Admin akkauntini bu yerdan o‘zgartirib bo‘lmaydi" }); return; }
          const existingStaff = await db.get("SELECT role FROM users WHERE telegram_id = ?", telegramId);
          if (existingStaff && existingStaff.role === "super_admin") { sendJson(res, 409, { error: "Boshqa Super Admin akkauntini bu yerdan o‘zgartirib bo‘lmaydi" }); return; }
          await db.run("INSERT INTO users(telegram_id, full_name, role) VALUES (?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET full_name = CASE WHEN excluded.full_name <> '' THEN excluded.full_name ELSE users.full_name END, role = excluded.role, is_active = 1, updated_at = CURRENT_TIMESTAMP", telegramId, fullName, role);
          const user = await db.get("SELECT id, telegram_id, username, full_name, role, is_active, created_at FROM users WHERE telegram_id = ?", telegramId);
          if (role === "worker") await saveWorkerProfile(user.id, workerProfile);
          await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'create_or_promote', 'staff', ?, ?)", actor.id, telegramId, JSON.stringify({ role }));
          sendJson(res, 201, { staff: user }); return;
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
    if (pathname === "/api/orders" && req.method === "POST") {
      try {
        const body = await readJson(req, 16000), telegramUser = verifyTelegramInitData(body.initData);
        if (!telegramUser?.id) { sendJson(res, 401, { error: "Buyurtma berish uchun Telegram ichidan oching va profilni tasdiqlang" }); return; }
        const incoming = body.order;
        if (!incoming || !Array.isArray(incoming.items) || incoming.items.length < 1 || incoming.items.length > 50) { sendJson(res, 400, { error: "Savatchadagi mahsulotlarni tekshiring" }); return; }
        const deliveryMethod = incoming.deliveryMethod === "bts" ? "bts" : ["courier","address"].includes(incoming.deliveryMethod) ? "address" : "";
        const phone = cleanText(incoming.phone, 24), address = cleanText(incoming.address, 500), recipientName = cleanText(incoming.recipientName, 100);
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
          await db.run("INSERT INTO orders(order_number, customer_id, status, payment_status, delivery_method, recipient_name, delivery_phone, delivery_address, delivery_fee_uzs, subtotal_uzs, total_uzs, customer_note) VALUES (?, ?, 'pending_payment', 'pending', ?, ?, ?, ?, 0, ?, ?, ?)", orderNumber, customer.id, deliveryMethod, recipientName, phone, address, subtotal, subtotal, "");
          const order = await db.get("SELECT id FROM orders WHERE order_number = ?", orderNumber);
          for (const line of orderItems) await db.run("INSERT INTO order_items(order_id, product_id, model_snapshot, name_snapshot, quantity, unit_price_uzs, line_total_uzs) VALUES (?, ?, ?, ?, ?, ?, ?)", order.id, line.product.id, line.product.model, line.product.name, line.quantity, Number(line.product.price_uzs), line.lineTotal);
          await db.run("INSERT INTO payments(order_id, amount_uzs, method, status) VALUES (?, ?, 'qr', 'pending')", order.id, subtotal);
          await db.run("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'create', 'order', ?, ?)", customer.id, orderNumber, JSON.stringify({ itemCount: orderItems.length, totalUzs: subtotal, deliveryMethod }));
          return { orderNumber, total: subtotal, itemCount: orderItems.length, customerName: fullName || "Telegram mijoz", telegramId, phone, address, deliveryMethod };
        });
        if (superAdminId) {
          const note = "🛒 Yangi UzCam buyurtma: " + saved.orderNumber + "\nMijoz: " + saved.customerName + "\nTelegram ID: " + saved.telegramId + "\nTelefon: " + saved.phone + "\nYetkazish: " + (saved.deliveryMethod === "bts" ? "BTS" : "Manzilga") + "\nManzil: " + saved.address + "\nMahsulotlar: " + saved.itemCount + " xil\nJami: " + new Intl.NumberFormat("uz-UZ").format(saved.total) + " so‘m\nHolat: to‘lov tasdig‘ini kutmoqda.";
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
    if (pathname === "/api/health") { await db.get("SELECT 1 AS ready"); sendJson(res,200,{status:"ok",database:"connected",databaseEngine:db.kind,imageStorage:imageStorageMode(),backendStage:"catalog-management"}); return; }
    if (pathname === "/api/products") { try { sendJson(res, 200, { products: await listPublicProducts(), categories: await listPublicCategories() }); } catch { sendJson(res, 500, { error: "Catalog unavailable" }); } return; }
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
try { await db.get("SELECT 1 AS ready"); await initializeImageStorage(); }
catch (error) { console.error("Database/storage initialization failed; check environment configuration"); process.exit(1); }
server.listen(port, "0.0.0.0", () => { console.log(`UzCam backend running on port ${port}`); void configureTelegramWebhook(); });
for(const signal of ["SIGINT","SIGTERM"]) process.once(signal,()=>{server.close(()=>{void db.close().finally(()=>process.exit(0));});setTimeout(()=>process.exit(1),10000).unref();});
