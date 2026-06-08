# Deploy

**Backend** e **Frontend** são **2 projetos independentes** com Docker próprio. Cada um tem seu `docker-compose.yml`. Eles se enxergam pela network compartilhada `wpp_net`.

```
AutomacaoWPP/
├── AgenteWPPAutomation/        # ← este projeto (backend Flask + WAHA)
│   ├── docker-compose.yml      # waha + api
│   ├── docker-compose.dev.yml  # override dev
│   ├── Dockerfile.api
│   ├── .env                    # OPENAI_API_KEY, GEMINI_API_KEY (gitignored)
│   └── ...
└── frontend/                   # ← projeto separado (React + TanStack Start)
    ├── docker-compose.yml      # só o frontend, network external
    ├── docker-compose.dev.yml  # override dev
    ├── Dockerfile              # prod (Bun build + Bun runtime)
    ├── Dockerfile.dev          # dev (Vite + HMR)
    └── ...
```

## Subir tudo (ordem importa)

### 1) Backend primeiro
```bash
cd AgenteWPPAutomation
docker compose up -d --build
```
Sobe `waha` + `api` e cria a network `wpp_net`.

### 2) Frontend depois
```bash
cd ../frontend
docker compose up -d --build
```
Conecta o frontend na network `wpp_net` e resolve o backend pelo nome `api`.

## Acessos

| Serviço | URL |
|---|---|
| **Frontend React** (URL principal) | `http://IP_HOST:4173` |
| Backend (API + Painel Jinja legado) | `http://IP_HOST:5050` |
| WAHA dashboard | `http://127.0.0.1:3030` (só do host — SSH tunnel pra acessar de fora) |

## Modo desenvolvimento (hot-reload)

Cada projeto tem seu override. Aplica em cima do compose principal:

```bash
# Backend (Flask --debug + volume mount)
cd AgenteWPPAutomation
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Frontend (Vite HMR + volume mount)
cd ../frontend
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## Como o proxy `/api/*` funciona

O browser fala SÓ com o frontend (`:4173`). Quando ele faz fetch em `/api/*`, o próprio frontend roteia pro backend:

| Ambiente | Caminho |
|---|---|
| **Dev (Vite)** | Browser → `:4173/api/*` → Vite proxy → `http://api:5000/api/*` |
| **Prod (Bun.serve)** | Browser → `:4173/api/*` → `src/server.ts` intercepta → `fetch("http://api:5000/api/*")` |

Em ambos, controlado pela env var **`VITE_API_TARGET`** no compose do frontend. Pra rodar o frontend apontando pra um backend em outra máquina:

```yaml
# em frontend/docker-compose.yml
frontend:
  environment:
    - VITE_API_TARGET=https://api.brandcast.com.br
```

E nesse caso o frontend não precisa da network `wpp_net` — basta remover.

## Variáveis de ambiente

**Backend** (`AgenteWPPAutomation/.env`, gitignored):
```
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AQ...
```
Outros (`docker-compose.yml`): `WHATSAPP_API_KEY`, `WAHA_DASHBOARD_USERNAME`, `WAHA_DASHBOARD_PASSWORD`.

**Frontend** (no `docker-compose.yml`): `VITE_API_TARGET`.

## Operações comuns

```bash
# Logs
docker compose logs -f                       # tudo do projeto atual
docker compose logs -f api                   # um serviço

# Reiniciar
docker compose restart api

# Parar
docker compose down                          # tudo do projeto atual
docker compose down -v                       # com volumes (perde estado!)

# Rebuild forçado
docker compose build --no-cache
docker compose up -d --force-recreate
```

## Volumes (estado persistente)

| Volume | Conteúdo | Onde mora |
|---|---|---|
| `waha_data` | Sessão pareada do WhatsApp | backend |
| `app_data` | SQLite `messages.db` + `chat_exports/` | backend |
| `chroma_data` | Vestígio do projeto RAG antigo | backend |

Volumes são gerenciados pelo Docker (não bind mount no host) em prod. Em dev, o override monta as pastas do host (`./data`, `./waha_data`) pra inspeção pelo editor.

## Network compartilhada `wpp_net`

- **Criada** pelo backend (`networks.wpp_net.name: wpp_net`)
- **Referenciada** pelo frontend (`networks.wpp_net.external: true`)

Se você subir o frontend ANTES do backend, vai dar erro de rede inexistente. Suba o backend primeiro.

Pra checar:
```bash
docker network ls | grep wpp_net
```
