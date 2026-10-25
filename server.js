import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
import { listPublicProducts, db } from "./backend/db.js";

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
function getAdminSession(req) {
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
  const user = db.prepare("SELECT id, telegram_id, username, full_name, phone, role, is_active FROM users WHERE telegram_id = ?").get(String(session.id));
  if (!user || !user.is_active || !["admin", "super_admin", "worker"].includes(user.role)) return null;
  return user;
}
async function readJson(req) {
  let body = "";
  for await (const chunk of req) { body += chunk; if (body.length > 10000) throw new Error("Request too large"); }
  return JSON.parse(body || "{}");
}

const DEFAULT_HOME_CONTENT = { hero: { eyebrow: "EZVIZ · aqlli videokuzatuv", title: "Uyingizni EZVIZ bilan himoyalang", description: "CS-H1C (1080P) — uy va biznes uchun aqlli kamera.", productId: 1, buttonText: "Kameralarni ko‘rish" }, videos: [], news: [] };
function cleanText(value, max) { return String(value || "").trim().slice(0, max); }
function normalizeHomeContent(input) {
  if (!input || typeof input !== "object") throw new Error("Kontent formati noto‘g‘ri");
  const hero = input.hero || {};
  const productId = Number(hero.productId);
  if (!Number.isSafeInteger(productId) || !db.prepare("SELECT 1 FROM products WHERE id = ? AND is_active = 1").get(productId)) throw new Error("Promo uchun faol mahsulot tanlang");
  const videos = (Array.isArray(input.videos) ? input.videos : []).slice(0, 6).map(item => {
    let url; try { url = new URL(String(item.url || "")); } catch { throw new Error("YouTube havolasini tekshiring"); }
    if (url.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(url.hostname)) throw new Error("Faqat YouTube havolasini kiriting");
    const videoId = url.hostname.includes("youtu.be") ? url.pathname.split("/").filter(Boolean)[0] : (url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]);
    if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) throw new Error("YouTube video manzili noto‘g‘ri");
    return { title: cleanText(item.title, 100), url: url.href, description: cleanText(item.description, 220), active: item.active !== false };
  }).filter(item => item.title && item.url);
  const news = (Array.isArray(input.news) ? input.news : []).slice(0, 8).map(item => ({ title: cleanText(item.title, 100), body: cleanText(item.body, 500), active: item.active !== false })).filter(item => item.title && item.body);
  return { hero: { eyebrow: cleanText(hero.eyebrow, 70), title: cleanText(hero.title, 120), description: cleanText(hero.description, 240), productId, buttonText: cleanText(hero.buttonText, 40) || "Kameralarni ko‘rish" }, videos, news };
}
function getHomeContent() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'homepage_content'").get();
  if (!row) return DEFAULT_HOME_CONTENT;
  try { return normalizeHomeContent(JSON.parse(row.value)); } catch { return DEFAULT_HOME_CONTENT; }
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
      [{ text: "📰 Yangiliklar" }, { text: "💬 Admin bilan aloqa" }]
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
  const match = incomingText.match(/^\/(start|help|menu|catalog|camera|videos|news|support|stop)(?:@\w+)?(?:\s|$)/i);
  const command = match ? match[1].toLowerCase() : "";

  if (superAdminId && senderId === superAdminId && message.reply_to_message && message.reply_to_message.message_id) {
    const link = db.prepare("SELECT customer_telegram_id FROM support_message_links WHERE admin_message_id = ?").get(message.reply_to_message.message_id);
    if (link) {
      if (command === "stop" || incomingText.toLowerCase() === "/close") {
        db.prepare("UPDATE support_threads SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE customer_telegram_id = ?").run(link.customer_telegram_id);
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
    const content = getHomeContent();
    const product = listPublicProducts().find(item => item.id === content.hero.productId);
    const price = product ? new Intl.NumberFormat("uz-UZ").format(product.price_uzs) + " so‘m" : "Narx katalogda";
    const lines = [content.hero.eyebrow, content.hero.title, content.hero.description, product ? product.brand + " " + product.name + " · " + price : "", "Katalogni ochib mavjud kameralarni ko‘ring."].filter(Boolean);
    await telegramApi("sendMessage", { chat_id: chat.id, text: shortTelegramText(lines.join("\n")), reply_markup: { inline_keyboard: [[{ text: "Kameralarni ko‘rish", web_app: { url: telegramAppUrl() } }]] } });
    return;
  }
  if (command === "videos" || incomingText === "📹 Video tavsiyalar") {
    const videos = getHomeContent().videos.filter(item => item.active);
    const text = videos.length ? "📹 Video tavsiyalar\n\n" + videos.map((item, index) => (index + 1) + ". " + item.title + (item.description ? "\n" + item.description : "") + "\n" + item.url).join("\n\n") : "Hozircha video tavsiyalar joylanmagan. Yangilari qo‘shilganda shu bo‘limda ko‘rinadi.";
    await sendBotMenu(chat.id, shortTelegramText(text));
    return;
  }
  if (command === "news" || incomingText === "📰 Yangiliklar") {
    const news = getHomeContent().news.filter(item => item.active);
    const text = news.length ? "📰 UzCam yangiliklari\n\n" + news.map((item, index) => (index + 1) + ". " + item.title + "\n" + item.body).join("\n\n") : "Hozircha yangi e’lon yo‘q. Yangiliklar qo‘shilganda shu bo‘limda ko‘rinadi.";
    await sendBotMenu(chat.id, shortTelegramText(text));
    return;
  }
  if (command === "support" || incomingText === "💬 Admin bilan aloqa") {
    if (!superAdminId) {
      await sendBotMenu(chat.id, "Admin bilan aloqa hozir sozlanmagan. Iltimos, keyinroq urinib ko‘ring.");
      return;
    }
    db.prepare("INSERT INTO support_threads(customer_telegram_id, is_active, updated_at) VALUES (?, 1, CURRENT_TIMESTAMP) ON CONFLICT(customer_telegram_id) DO UPDATE SET is_active = 1, updated_at = CURRENT_TIMESTAMP").run(senderId);
    await sendBotMenu(chat.id, "Admin bilan suhbat boshlandi. Xabaringizni shu yerga yozing. Suhbatni tugatish uchun /stop yuboring.");
    await telegramApi("sendMessage", { chat_id: superAdminId, text: "💬 Yangi mijoz murojaati\nIsm: " + [message.from && message.from.first_name, message.from && message.from.last_name].filter(Boolean).join(" ") + "\nUsername: " + (message.from && message.from.username ? "@" + message.from.username : "yo‘q") + "\nTelegram ID: " + senderId + "\nMijoz xabariga javob berish uchun uning yuborgan nusxasiga Reply qiling." });
    return;
  }
  if (command === "stop") {
    db.prepare("UPDATE support_threads SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE customer_telegram_id = ?").run(senderId);
    await sendBotMenu(chat.id, "Admin bilan suhbat yakunlandi. Yana bog‘lanish uchun menyudan aloqa tugmasini bosing.");
    return;
  }

  const activeThread = db.prepare("SELECT is_active FROM support_threads WHERE customer_telegram_id = ?").get(senderId);
  if (activeThread && activeThread.is_active && superAdminId) {
    try {
      await telegramApi("sendMessage", { chat_id: superAdminId, text: "📩 Mijoz xabari\nIsm: " + [message.from && message.from.first_name, message.from && message.from.last_name].filter(Boolean).join(" ") + "\nUsername: " + (message.from && message.from.username ? "@" + message.from.username : "yo‘q") + "\nTelegram ID: " + senderId + "\nQuyidagi xabarga Reply qilib javob yuboring." });
      const copied = await telegramApi("copyMessage", { chat_id: superAdminId, from_chat_id: chat.id, message_id: message.message_id });
      db.prepare("INSERT OR REPLACE INTO support_message_links(admin_message_id, customer_telegram_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run(copied.message_id, senderId);
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
    await telegramApi("setMyCommands", { commands: [{ command: "start", description: "UzCam bosh menyusi" }, { command: "catalog", description: "Mahsulotlar katalogi" }, { command: "camera", description: "EZVIZ kameralar" }, { command: "videos", description: "Video tavsiyalar" }, { command: "news", description: "Yangiliklar" }, { command: "support", description: "Admin bilan aloqa" }, { command: "stop", description: "Suhbatni yakunlash" }, { command: "help", description: "Yordam" }] });
    console.info("Telegram webhook configured");
  } catch (error) { console.error("Telegram webhook setup failed:", error.message); }
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400).end("Bad request"); return; }


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
    if (pathname === "/api/home-content" && req.method === "GET") { sendJson(res, 200, { content: getHomeContent() }); return; }
    if (pathname === "/api/home-content" && req.method === "PUT") {
      const actor = getAdminSession(req);
      if (!actor || !["admin", "super_admin"].includes(actor.role)) { sendJson(res, 403, { error: "Admin ruxsati talab qilinadi" }); return; }
      try {
        const content = normalizeHomeContent(await readJson(req));
        const value = JSON.stringify(content);
        db.prepare("INSERT INTO settings(key, value, updated_by, updated_at) VALUES ('homepage_content', ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP").run(value, actor.id);
        db.prepare("INSERT INTO audit_log(actor_id, action, entity_type, entity_id, details_json) VALUES (?, 'update', 'homepage_content', 'home', ?)").run(actor.id, JSON.stringify({ videos: content.videos.length, news: content.news.length, productId: content.hero.productId }));
        sendJson(res, 200, { content }); return;
      } catch (error) { sendJson(res, 400, { error: error.message || "Kontentni saqlab bo‘lmadi" }); return; }
    }
    if (pathname === "/api/session" && req.method === "POST") {
      try {
        const body = await readJson(req);
        const telegramUser = verifyTelegramInitData(body.initData);
        if (!telegramUser?.id) { sendJson(res, 401, { error: "Telegram tasdiqlashi yaroqsiz yoki eskirgan" }); return; }
        const telegramId = String(telegramUser.id);
        const existing = db.prepare("SELECT role FROM users WHERE telegram_id = ?").get(telegramId);
        const superAdminId = process.env.SUPER_ADMIN_TELEGRAM_ID;
        const role = superAdminId && telegramId === String(superAdminId) ? "super_admin" : (existing?.role || "customer");
        const fullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ");
        db.prepare("INSERT INTO users (telegram_id, username, full_name, role) VALUES (?, ?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username, full_name = excluded.full_name, role = CASE WHEN users.role = 'super_admin' OR excluded.role = 'super_admin' THEN 'super_admin' ELSE users.role END, updated_at = CURRENT_TIMESTAMP").run(telegramId, telegramUser.username || null, fullName, role);
        const user = db.prepare("SELECT id, telegram_id, username, full_name, phone, role, is_active FROM users WHERE telegram_id = ?").get(telegramId);
        if (!user.is_active) { sendJson(res, 403, { error: "Ushbu foydalanuvchi faolsiz" }); return; }
        const payload = Buffer.from(JSON.stringify({ id: telegramId, exp: Date.now() + 2 * 60 * 60 * 1000 })).toString("base64url");
        const signature = createHmac("sha256", process.env.TELEGRAM_BOT_TOKEN).update(payload).digest("base64url");
        res.setHeader("Set-Cookie", `uzcam_session=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=7200`);
        sendJson(res, 200, { user: sessionUser(user) }); return;
      } catch { sendJson(res, 400, { error: "Profil so‘rovini o‘qib bo‘lmadi" }); return; }
    }
    if (pathname === "/api/session" && req.method === "GET") {
      const user = getAdminSession(req);
      if (!user) { sendJson(res, 401, { error: "Admin sessiyasi topilmadi" }); return; }
      sendJson(res, 200, { user: sessionUser(user) }); return;
    }
    if (req.method !== "GET") { sendJson(res, 405, { error: "Method not allowed" }); return; }
    if (pathname === "/api/health") { sendJson(res, 200, { status: "ok", database: "connected", backendStage: "foundation" }); return; }
    if (pathname === "/api/products") { try { sendJson(res, 200, { products: listPublicProducts() }); } catch { sendJson(res, 500, { error: "Catalog unavailable" }); } return; }
    sendJson(res, 404, { error: "API route not found" }); return;
  }

  if (pathname === "/admin-preview.html" && !getAdminSession(req)) { res.writeHead(404, { "Content-Type":"text/plain; charset=utf-8" }).end("Not found"); return; }
  if (pathname === "/") pathname = "/index.html";
  const file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, "index.html")) { res.writeHead(403).end("Forbidden"); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, { "Content-Type":"text/plain; charset=utf-8" }).end("Not found"); return; }
    res.writeHead(200, { "Content-Type":types[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control":pathname.startsWith("/assets/") ? "public, max-age=86400, stale-while-revalidate=604800" : "no-cache", "X-Content-Type-Options":"nosniff" });
    fs.createReadStream(file).pipe(res);
  });
});

const port = Number(process.env.PORT || 3000);
try { db.prepare("SELECT 1 AS ready").get(); }
catch (error) { console.error("Database initialization failed:", error.message); process.exit(1); }
server.listen(port, "0.0.0.0", () => { console.log(`UzCam backend running on port ${port}`); void configureTelegramWebhook(); });