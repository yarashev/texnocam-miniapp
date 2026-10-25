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
function sessionUser(user) { return { id: user.telegram_id, username: user.username || "", fullName: user.full_name || "", phone: user.phone || "", role: user.role }; }

const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400).end("Bad request"); return; }

  if (pathname.startsWith("/api/")) {
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
server.listen(port, "0.0.0.0", () => console.log(`UzCam backend running on port ${port}`));