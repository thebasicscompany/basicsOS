

<h3 align="center">Open-Source CRM Desktop App for Modern Teams</h3>

<p align="center">
  Contacts, companies, deals, tasks, notes, AI chat, and automations in one desktop app.<br/>
  <strong>Open-source core. Commercial services available.</strong>
</p>

<p align="center">
  <a href="https://www.basicsos.com/">Website</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/frontend-React%2019-61DAFB?style=flat-square" alt="React 19" />
  <img src="https://img.shields.io/badge/backend-Hono%20%2B%20Drizzle-0EA5E9?style=flat-square" alt="Hono + Drizzle" />
  <img src="https://img.shields.io/badge/database-PostgreSQL-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square" alt="AGPL-3.0" />
  <img src="https://img.shields.io/badge/version-0.1.0-green?style=flat-square" alt="v0.1.0" />
</p>

---

## What is BasicsOS?

BasicsOS is an Electron-first CRM desktop app built with React, Vite, and a Node/Hono REST API. It supports configurable CRM objects, custom fields, generic list/detail views, workflow automations, and AI-assisted operations.

This repository is the open-source codebase. Commercial offerings may include hosted infrastructure, support SLAs, and managed services.

**Stack:** Data is stored in **PostgreSQL** (Drizzle ORM); auth is **Better Auth**. Use your own Postgres by setting `DATABASE_URL` to your connection string (e.g. Supabase, Neon, or any Postgres host)—no lock-in. Custom auth backends are not supported out of the box; fork and adapt if needed.

---

## Product Screenshots

Add product visuals here when ready.

```md
![Dashboard](./public/screenshots/dashboard.png)
![Deals Pipeline](./public/screenshots/deals-pipeline.png)
![AI Chat](./public/screenshots/ai-chat.png)
```

---

## Core Features

- Configurable CRM objects and custom fields
- Contacts, companies, deals, tasks, notes, and activity tracking
- Saved views, filters, and sorts across list/detail experiences
- Built-in AI chat and streaming assistant
- Workflow automation builder (email, AI, CRM, Slack, Gmail)
- REST API server with Hono + Drizzle + PostgreSQL
- Electron desktop app experience

---

## Quick Start

### Prerequisites

You must have all of the following installed before running BasicsOS locally:

- Node.js `22+` (LTS recommended)
- pnpm `10+`
- Docker Desktop (or Docker Engine + Compose plugin)
- Git

Quick checks:

```sh
node -v
pnpm -v
docker --version
docker compose version
git --version
```

If any command fails, install that dependency first.

### Option A: One-command setup

```sh
git clone https://github.com/thebasicscompany/basicsOSnew.git
cd basicsOSnew
pnpm run setup
```

The setup script installs deps and will:
- Check prerequisites (Node, pnpm, Docker, Git)
- Ask whether you want **development** or **production** deployment
- **Development:** Install deps, start Postgres, create `.env` with generated secrets, run migrations, seed admin (`admin@example.com` / `admin123`)
- **Production:** Install deps, optionally start Postgres, create `.env`, run migrations (no seed). You configure `DATABASE_URL`, `BETTER_AUTH_URL`, and `ALLOWED_ORIGINS` before going live.

Then run the app:

```sh
pnpm run dev:all
```

### Option B: Manual setup

<details>
<summary>Click to expand manual steps</summary>

1. **Clone and install**
   ```sh
   git clone https://github.com/thebasicscompany/basicsOSnew.git
   cd basicsOSnew
   pnpm install
   ```

2. **Start Postgres**
   ```sh
   docker compose up -d
   ```

3. **Configure backend and migrate**
   ```sh
   cd packages/server
   cp .env.example .env
   # Set BETTER_AUTH_SECRET (min 32 chars), e.g. openssl rand -base64 32
   # Set API_KEY_ENCRYPTION_KEY (32-byte hex), e.g. openssl rand -hex 32
   pnpm db:migrate
   pnpm db:seed   # Creates admin@example.com / admin123 — dev only, blocked in production
   cd ../..
   ```

4. **Run the desktop app + API**
   ```sh
   pnpm run dev:all
   ```

</details>

Login (dev):

- Email: `admin@example.com`
- Password: `admin123`

---

## Environment Variables

`packages/server/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5435/crm` | Your PostgreSQL connection string. Use your own database (e.g. [Supabase](https://supabase.com), [Neon](https://neon.tech), or any Postgres host)—no lock-in. |
| `BETTER_AUTH_SECRET` | Yes | N/A | Better Auth secret (min 32 chars) |
| `BETTER_AUTH_URL` | No | `http://localhost:5173` | Auth callback base URL (see Production) |
| `BASICSOS_API_URL` | No | `https://api.basicsos.com` | **Gateway** URL: where the server sends AI/chat, embeddings, voice, email, Slack. Leave default to use Basics gateway (BYOK supported). Set only if you run your own gateway. |
| `ALLOWED_ORIGINS` | No | (empty) | Comma-separated origins for CORS + Better Auth (e.g. `https://api.acme.com`) |
| `API_KEY_ENCRYPTION_KEY` | Prod | N/A | 32-byte base64/hex key for encrypting stored API keys. Required for production. |
| `PORT` | No | `3001` | API server port |
| `SERVER_BASICS_API_KEY` | No | N/A | Server-level BasicsOS key for all users (env fallback). Overridden by admin UI config. |
| `SERVER_BYOK_PROVIDER` | No | N/A | BYOK provider (`openai`, `anthropic`, `gemini`). Used with `SERVER_BYOK_API_KEY`. |
| `SERVER_BYOK_API_KEY` | No | N/A | BYOK API key. Requires `SERVER_BYOK_PROVIDER`. |

---

## Production Deployment

For a guided production setup, run `pnpm run setup` and choose **Production**.

### API server

1. **Run migrations before starting the server:**
   ```sh
   cd packages/server && pnpm db:migrate
   ```

2. **Do not run `pnpm db:seed` in production.** Seed creates a default admin and is blocked when `NODE_ENV=production`.

3. **Required production env vars:**
   - `DATABASE_URL` – Production Postgres (use SSL, strong credentials).
   - `BETTER_AUTH_SECRET` – Min 32 chars; use `openssl rand -base64 32`.
   - `BETTER_AUTH_URL` – Your production API base URL (e.g. `https://api.yourcompany.com`).
   - `ALLOWED_ORIGINS` – Origins for auth callbacks and CORS (e.g. your API URL).
   - `API_KEY_ENCRYPTION_KEY` – 32-byte key for encrypting stored API keys.

### Users and admins in production

- **First account = admin.** The first user to sign up (via the app’s signup page) creates the organization and becomes an administrator. There is no separate “create admin” step—whoever signs up first is the admin.
- **Everyone else needs an invite.** After the first user exists, signup is invite-only. Admins create invite links/tokens from the app (e.g. Settings or team/invites); new users sign up using that invite. So only the first account is open; all later accounts require an admin to invite them.

### Docker

A Dockerfile is provided for the API server. Build and run:

```sh
docker build -t basicsos-server .
docker run -p 3001:3001 \
  -e DATABASE_URL=postgresql://... \
  -e BETTER_AUTH_SECRET=... \
  -e BETTER_AUTH_URL=https://api.yourcompany.com \
  -e ALLOWED_ORIGINS=https://api.yourcompany.com \
  basicsos-server
```

Use `docker compose` with the included `docker-compose.yml` for Postgres; add a `server` service that uses this image.

### Electron app (CRM API URL)

The desktop app talks to **your CRM API server** (the Hono server), not the gateway. For packaged builds:

- **Same machine:** Default `http://localhost:3001` is used if unset.
- **Remote CRM server:** Set `BASICSOS_API_URL` (or `VITE_API_URL`) when launching the app so it points at your server, e.g. `https://api.yourcompany.com`:
  ```sh
  # macOS / Linux
  BASICSOS_API_URL=https://api.yourcompany.com open "Basics Hub.app"
  ```
  On Windows, set the variable in a shortcut or batch file before starting the app.

- **Build-time:** Set `VITE_API_URL` during the Electron build to bake the CRM API URL into the renderer. The main process uses `process.env.BASICSOS_API_URL` at runtime (often empty in a packaged app unless set at launch).

---

## API Keys and BYOK

AI features (chat, embeddings, voice) go through the **Basics gateway** (default `https://api.basicsos.com`). Keys are configured **once by the admin**, shared across all users in the organization.

### How it works

1. **Admin configures** a single API key for the organization — either a BasicsOS key or a BYOK provider key (OpenAI, Anthropic, Gemini).
2. **All users** get AI features automatically — no per-user key setup needed.
3. **Usage tracking** — admins can see per-user token and request usage from the AI Usage dashboard (sidebar → Admin → AI Usage).

### Configuration options (pick one)

- **Admin UI** (recommended): The admin configures the key from **Settings → AI Configuration** in the app. Supports switching between BasicsOS and BYOK.
- **Environment variables** (fallback): Set `SERVER_BASICS_API_KEY` or `SERVER_BYOK_PROVIDER` + `SERVER_BYOK_API_KEY` in `packages/server/.env`. Admin UI config takes priority when both are set.
- **BYOK (bring your own key)** — The default gateway supports your own provider keys (OpenAI, Anthropic, Gemini) via `x-byok-provider` and `x-byok-api-key` headers. See [gateway API docs](https://basicsos.com/api-docs).
- **Transcription BYOK** — Voice transcription (speech-to-text) can use a separate Deepgram key. In **Settings → AI Configuration** use the optional "Transcription (BYOK)" section, or set `SERVER_TRANSCRIPTION_BYOK_PROVIDER=deepgram` and `SERVER_TRANSCRIPTION_BYOK_API_KEY` in `.env`.


---

## Monorepo Structure

```text
packages/
  server/
  hub/
  automations/
  voice/
  mcp-viewer/
  shared/
src/
  components/
  hooks/
  providers/
```

---

## Common Commands

```sh
pnpm run dev:all       # desktop app + API (recommended)
pnpm run dev:electron  # Electron only
pnpm run dev:server    # API only
pnpm run dev:rest      # web frontend + API (debug/alternate workflow)
pnpm run dev           # web frontend only
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build
```

Database commands:

```sh
cd packages/server
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:seed
pnpm db:studio
```

---

## Troubleshooting

- Ensure Docker is running and Postgres container is healthy.
- Confirm ports are free: `3001` (API), `5435` (Postgres), and `5173` if using web debug mode.
- If auth fails, verify `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` in `packages/server/.env`.

---

## OSS and Commercial

BasicsOS is open-source under AGPL-3.0 in this repository.

Commercial offerings can include hosted deployments, managed operations, compliance support, and enterprise service layers on top of the OSS core.

---

## Contributing

Contributions are welcome. See [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md).

## Code of Conduct

See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## License

AGPL-3.0. See [`LICENSE.md`](./LICENSE.md).
