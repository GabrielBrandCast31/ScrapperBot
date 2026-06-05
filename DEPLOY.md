# Deploy

Stack desacoplada em 3 containers Docker.

## Modo PRODUÇÃO

```bash
docker compose up -d --build
```

- **Frontend** (URL principal):  http://IP_DO_HOST:4173
- **Backend API**:                http://IP_DO_HOST:5050  (também serve o painel Jinja legado em `/painel/*`)
- **WAHA dashboard**:             http://127.0.0.1:3030  (só do servidor — use SSH tunnel: `ssh -L 3030:127.0.0.1:3030 user@host`)

Em produção:
- Nenhum volume mount de código (a imagem é self-contained)
- Threads de background do backend (auditoria IA, backfill, healer) sobem direto, sem reloader
- Volumes nomeados Docker preservam estado: `waha_data`, `app_data`, `chroma_data`

## Modo DESENVOLVIMENTO

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Diferenças:
- Backend roda com `FLASK_DEBUG=true` e hot-reload (volume mount `.:/app`)
- Frontend roda em Vite dev server com HMR (Dockerfile.dev em vez de Dockerfile)
- `waha_data/` e `data/` ficam no host (não em volume nomeado) — fácil de inspecionar pelo editor

## Variáveis de ambiente

Crie um `.env` na raiz com:

```
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AQ...
```

Outras configurações ficam no `docker-compose.yml`:
- `VITE_API_TARGET` (frontend): endereço do backend pro proxy `/api/*` (default `http://api:5000` na rede interna do compose)
- `WAHA_DASHBOARD_USERNAME` / `PASSWORD`: credenciais do dashboard WAHA
- `WHATSAPP_API_KEY`: chave que api↔waha usam pra autenticar (`minha-chave-secreta` por default)

## Operações comuns

```bash
# Logs de tudo
docker compose logs -f

# Logs de um serviço
docker compose logs -f frontend
docker compose logs -f api
docker compose logs -f waha

# Reiniciar um serviço
docker compose restart api

# Parar tudo
docker compose down

# Parar tudo e remover volumes (perde estado!)
docker compose down -v

# Rebuild forçado de um serviço
docker compose build --no-cache frontend
docker compose up -d --force-recreate frontend
```

## Migrar do dev pro prod ou vice-versa

Os 2 modos compartilham volumes. Pra trocar:

```bash
docker compose down                                                       # para tudo
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d      # sobe em dev
# ou
docker compose up -d --build                                              # sobe em prod
```

## Estrutura

```
.
├── Dockerfile.api                  # Backend prod
├── frontend/
│   ├── Dockerfile                  # Frontend prod (multi-stage Bun build + Bun runtime)
│   └── Dockerfile.dev              # Frontend dev (Vite + HMR)
├── docker-compose.yml              # Stack prod
├── docker-compose.dev.yml          # Override dev
├── .dockerignore                   # Ignora frontend/, runtime state, __pycache__/...
└── frontend/.dockerignore          # Ignora node_modules/, .output/, .lovable/
```

## Como o proxy `/api/*` funciona

| Ambiente | Caminho do request |
|---|---|
| **Dev (Vite)** | Browser → `localhost:4173/api/*` → Vite proxy → `api:5000/api/*` |
| **Prod (Bun.serve + handler)** | Browser → `localhost:4173/api/*` → `src/server.ts` intercepta → `fetch(api:5000/api/*)` → retorna |

Ambos os caminhos respeitam `VITE_API_TARGET`. Pra rodar o frontend **separado** do backend (ex: backend em outra máquina), basta sobrescrever no compose:

```yaml
frontend:
  environment:
    - VITE_API_TARGET=https://api.brandcast.com.br
```
