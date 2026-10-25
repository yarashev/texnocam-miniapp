import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { listPublicProducts, db } from "./backend/db.js";

const root = process.cwd();
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".webp":"image/webp", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".svg":"image/svg+xml" };
const sendJson = (res, status, body) => { res.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" }); res.end(JSON.stringify(body)); };

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400).end("Bad request"); return; }

  if (pathname.startsWith("/api/")) {
    if (req.method !== "GET") { sendJson(res, 405, { error: "Method not allowed" }); return; }
    if (pathname === "/api/health") { sendJson(res, 200, { status: "ok", database: "connected", backendStage: "foundation" }); return; }
    if (pathname === "/api/products") { try { sendJson(res, 200, { products: listPublicProducts() }); } catch { sendJson(res, 500, { error: "Catalog unavailable" }); } return; }
    sendJson(res, 404, { error: "API route not found" }); return;
  }

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
server.listen(port, "0.0.0.0", () => console.log(`TexnoCam backend running on port ${port}`));