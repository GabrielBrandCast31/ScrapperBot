// Wrapper de runtime do TanStack Start (preset Cloudflare Worker-like).
// `dist/server/server.js` exporta { fetch(request, env, ctx) }. Bun aceita
// esse formato direto via Bun.serve.

import handler from "./dist/server/server.js";

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || "0.0.0.0";

Bun.serve({
  port,
  hostname,
  fetch: (req) => handler.fetch(req, {}, {}),
});

console.log(`Frontend rodando em http://${hostname}:${port}`);
