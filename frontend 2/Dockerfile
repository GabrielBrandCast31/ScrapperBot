# Frontend producao. Multi-stage:
#   1) Bun builda React + TanStack Start -> dist/{client,server}
#   2) Bun runtime serve via start.mjs (Bun.serve + assets + SSR + proxy /api)

FROM oven/bun:1.1 AS builder
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install
COPY . .
RUN bun run build

FROM oven/bun:1.1 AS runtime
WORKDIR /app
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
