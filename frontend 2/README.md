# Frontend — BrandCast (ScrapperBot)

Painel React do monitor de atendimento BrandCast.

**Stack:** React + TypeScript + TanStack Router/Start + TanStack Query + Tailwind v4 + shadcn/ui + Bun.

## Rodar com Docker

Este projeto é **independente do backend**. Pra que funcione, o backend (em `../AgenteWPPAutomation/`) precisa estar rodando, porque o frontend faz proxy de `/api/*` pra ele.

```bash
# 1) Sobe o backend primeiro (em outro terminal, na pasta dele)
cd ../AgenteWPPAutomation
docker compose up -d

# 2) Sobe o frontend
cd ../frontend
docker compose up -d
```

Abra `http://localhost:4173` (ou `http://IP-DO-HOST:4173` da LAN).

### Modo desenvolvimento (HMR)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## Apontar pra um backend remoto

Sobrescreve `VITE_API_TARGET` no `docker-compose.yml`:

```yaml
services:
  frontend:
    environment:
      - VITE_API_TARGET=https://api.brandcast.com.br
```

Nesse caso o frontend não precisa da network `wpp_net` — remove a seção `networks:` do compose.

## Rodar sem Docker (dev local)

```bash
bun install
VITE_API_TARGET=http://localhost:5050 bun run dev
```

Abra `http://localhost:3000`. O proxy `/api/*` aponta pro backend em `localhost:5050`.

## Estrutura

```
frontend/
├── src/
│   ├── routes/          # rotas TanStack (index, conexao, insights, ...)
│   ├── components/      # app-shell, app-sidebar, kpi-card, ui/ (shadcn)
│   ├── lib/api/         # client HTTP (apiGet, apiPost, apiPostForm)
│   └── server.ts        # entry SSR + proxy /api -> backend (prod)
├── Dockerfile           # prod (Bun build + Bun runtime)
├── Dockerfile.dev       # dev (Vite + HMR)
├── docker-compose.yml
├── docker-compose.dev.yml
├── start.mjs            # wrapper Bun.serve (assets + SSR + proxy)
└── vite.config.ts       # proxy /api -> http://api:5000 (dev only)
```

## Endpoints consumidos

Todos via proxy `/api/*` → backend Flask:

- `GET  /api/insights`             — KPIs + top conversas
- `GET  /api/conversas`            — lista
- `GET  /api/conversas/:id`        — mensagens + nome
- `GET  /api/clientes`             — grupos monitorados
- `GET  /api/auditoria`            — resumos da IA
- `POST /api/auditoria/rodar`      — força um ciclo
- `POST /api/chat-ia/perguntar`    — Chat IA
- `POST /api/conversas/:id/sincronizar` — upload .txt do WhatsApp (multipart)
- `POST /api/importar-arquivo`     — cria cliente novo via .txt
- `GET  /api/conexao/status`       — estado da sessão WhatsApp
- `GET  /api/conexao/qr`           — QR code PNG
- `POST /api/conexao/{start,stop,restart,logout,reconectar}`
