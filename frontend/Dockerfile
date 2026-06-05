# Frontend de producao. Multi-stage:
#   1) Bun builda o React + TanStack Start (sai em dist/{client,server})
#   2) Bun runtime carrega o handler de SSR via wrapper start.mjs e serve
#      via Bun.serve. /api/* eh proxiado pelo proprio server (vide src/server.ts)
#      pro backend Flask atraves de VITE_API_TARGET.

# === Stage 1: builder ===
FROM oven/bun:1.1 AS builder

WORKDIR /app

# Cache de deps em layer separada
COPY package.json bun.lock bunfig.toml ./
RUN bun install

# Codigo
COPY . .

# Build → /app/dist/{client,server}
RUN bun run build

# === Stage 2: runtime ===
FROM oven/bun:1.1 AS runtime

WORKDIR /app

# Copia somente o necessario pra rodar:
#   - dist/         : build artifacts
#   - node_modules/ : runtime deps (TanStack Start, h3, etc.)
#   - start.mjs     : wrapper Bun.serve
#   - package.json  : metadata
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/start.mjs ./start.mjs
COPY --from=builder /app/package.json ./package.json

ENV PORT=3000 \
    HOST=0.0.0.0 \
    NODE_ENV=production \
    VITE_API_TARGET=http://api:5000

EXPOSE 3000

CMD ["bun", "run", "/app/start.mjs"]
