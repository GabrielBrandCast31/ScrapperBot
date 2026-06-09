// Wrapper Bun.serve: serve assets estaticos + SSR + proxy /api.
import handler from "./dist/server/server.js";
import { statSync } from "node:fs";
import { normalize, resolve, sep } from "node:path";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const CLIENT_DIR = resolve("/app/dist/client");

function safeStaticPath(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return null; }
  p = normalize(p).replace(/^\/+/, "");
  const abs = resolve(CLIENT_DIR, p);
  if (!abs.startsWith(CLIENT_DIR + sep) && abs !== CLIENT_DIR) return null;
  try { const st = statSync(abs); return st.isFile() ? abs : null; } catch { return null; }
}

Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = safeStaticPath(url.pathname);
    if (filePath) {
      return new Response(Bun.file(filePath), {
        headers: {
          "cache-control": filePath.includes("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=300",
        },
      });
    }
    return handler.fetch(req, {}, {});
  },
});

console.log(`Frontend up on http://${HOST}:${PORT}`);
