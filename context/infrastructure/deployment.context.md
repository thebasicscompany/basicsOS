# Deployment — Infrastructure Context

## Running Locally

```bash
pnpm dev:setup    # generates .env, starts Docker, migrates, seeds
```

Then:
```bash
pnpm --filter @basicsos/api dev    # API on :3001
pnpm --filter @basicsos/web dev    # Web on :3000
```

## Self-Hosted Production

Run everything with Docker Compose:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Services
| Service | Port | What it does |
|---------|------|-------------|
| `web` | 3000 | Next.js web portal |
| `api` | 3001 | Hono + tRPC API server |
| `mcp-company` | 4000 | Company MCP server (HTTP mode) |
| `postgres` | 5432 | PostgreSQL 16 + pgvector |
| `redis` | 6379 | BullMQ queues |

### Dockerfiles
- `apps/web/Dockerfile` — Next.js multi-stage build
- `packages/api/Dockerfile` — API server multi-stage build
- `apps/mcp/company/Dockerfile` — MCP server build

### Reverse Proxy (Caddy)
`infra/caddy/Caddyfile` — automatic HTTPS, routes:
- `yourdomain.com` → web (3000)
- `api.yourdomain.com` → API (3001)
- `mcp.yourdomain.com` → MCP (4000)

## CI/CD Pipeline

`.github/workflows/ci.yml` runs on every push and PR:
1. Install dependencies (frozen lockfile)
2. Build all packages in dependency order
3. Typecheck: shared → db → auth → api → web
4. Unit tests: `pnpm --filter @basicsos/shared test && pnpm --filter @basicsos/api test`
5. Integration tests: `npx vitest run` (RBAC audit, input validation, secrets scan)
6. Security audit: `pnpm audit --audit-level moderate`

## Environment Variables

### Required
```bash
DATABASE_URL=postgresql://user:pass@host:5432/basicos
REDIS_URL=redis://host:6379
BETTER_AUTH_SECRET=<32-byte-hex>
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

### AI features (optional)
```bash
ANTHROPIC_API_KEY=sk-ant-...   # enables AI assistant, summarization, embeddings
OPENAI_API_KEY=sk-...          # alternative provider
```

### Other optional
```bash
RESEND_API_KEY=re_...          # email delivery for invites
DEEPGRAM_API_KEY=...           # live meeting transcription
NEXT_PUBLIC_COLLAB_URL=ws://...  # real-time document collaboration
```

## Security requirements
- Generate `BETTER_AUTH_SECRET` with `openssl rand -hex 32`
- Set `POSTGRES_PASSWORD` in production — `docker-compose.prod.yml` fails fast if not set
- Never use dev defaults in production

## Database Migrations

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Visual database browser
pnpm db:studio
```

Migrations live in `packages/db/migrations/`. They run automatically in `pnpm dev:setup`.
