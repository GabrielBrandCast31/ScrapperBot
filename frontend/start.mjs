// Wrapper de runtime do TanStack Start (preset Cloudflare Worker-like).
// `dist/server/server.js` exporta { fetch(request, env, ctx) }. Bun aceita
// esse formato direto via Bun.serve.
//
// IMPORTANTE: o preset Cloudflare espera que os assets em /assets/* sejam
// servidos por uma binding externa (Workers Sites). Em Node/Bun precisamos
// fazer isso manualmente — checamos primeiro se a request bate em um arquivo
// real em dist/client/. Se sim, devolvemos; se nao, passamos pro handler SSR.

import handler from "./dist/server/server.js";
import { statSync } from "node:fs";
import { join, normalize, resolve, sep } from "node:path";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const CLIENT_DIR = resolve("/app/dist/client");

function safeStaticPath(pathname) {
  // Decodifica e normaliza pra evitar path traversal
  let p;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  p = normalize(p).replace(/^\/+/, "");
  const abs = resolve(CLIENT_DIR, p);
  if (!abs.startsWith(CLIENT_DIR + sep) && abs !== CLIENT_DIR) return null;
  try {
    const st = statSync(abs);
    return st.isFile() ? abs : null;
  } catch {
    return null;
  }
}

Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const url = new URL(req.url);
    // 1) Asset estatico? (dist/client/...)
    const filePath = safeStaticPath(url.pathname);
    if (filePath) {
      const file = Bun.file(filePath);
      return new Response(file, {
        headers: {
          // Cache agressivo pra assets com hash no nome
          "cache-control": filePath.includes("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=300",
        },
      });
    }
    // 2) SSR / proxy /api/* (vide src/server.ts)
    return handler.fetch(req, {}, {});
  },
});

console.log(`Frontend up on http://${HOST}:${PORT}`);
