# BasicsOS Railway Hosting Guide

This guide walks you through deploying BasicsOS to [Railway](https://railway.app) for self-hosting. You’ll run:

- **Web app** – Same as the Electron app, minus the voice overlay (not supported in browsers)
- **API server** – Backend used by the web app and by the Electron desktop app
- **PostgreSQL** – Database for CRM data, auth, and automations

The **Electron desktop app** is built locally and distributed separately. Users point it at your server URL.

---

## Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────┐
│   Web (Browser)     │────▶│                      │
│   Same origin       │     │   Railway Server     │
└─────────────────────┘     │   (API + Static)     │◀──── Electron desktop app
                            │   + PostgreSQL       │      (user builds & distributes)
                            └──────────────────────┘
```

- **Web**: Frontend + API on the same origin, served by one service.
- **Electron**: Points to your server URL and uses the voice overlay (Electron-only).
- **Database**: PostgreSQL provisioned by Railway.

---

## Prerequisites

- [Railway](https://railway.app) account (or GitHub login)
- BasicsOS repo (or your fork)

---

## Step 1: Create a Railway Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **Deploy from GitHub repo**
3. Select your BasicsOS repository
4. Railway will create a project and detect the codebase

---

## Step 2: Add PostgreSQL

1. In the Railway project, click **+ New**
2. Choose **Database** → **Add PostgreSQL**
3. Wait for it to deploy
4. The PostgreSQL service will expose `DATABASE_URL`

---

## Step 3: Configure the BasicsOS Service

1. Click on the BasicsOS service (the one from your repo)
2. Go to **Settings**

### Build settings

- **Builder**: Dockerfile (or leave default if Railway picks `Dockerfile.railway`)
- **Dockerfile path** (if asked): `Dockerfile.railway`

### Environment variables

In **Variables**, add:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Yes (reference Postgres service) |
| `BETTER_AUTH_SECRET` | Generate with `openssl rand -base64 32` | Yes |
| `BETTER_AUTH_URL` | Your app’s public URL (set after generating domain) | Yes |
| `API_KEY_ENCRYPTION_KEY` | 32-byte hex, e.g. `openssl rand -hex 32` | Yes (production) |
| `ALLOWED_ORIGINS` | Empty when web+API are same origin | Optional |
| `BASICSOS_API_URL` | `https://api.basicsos.com` (default) | Optional (AI gateway) |

**How to reference PostgreSQL:**

- `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
- Replace `Postgres` with the exact name of your Postgres service in the project.

---

## Step 4: Generate a Public Domain

1. Select the BasicsOS service
2. Open **Settings** → **Networking**
3. Click **Generate Domain**
4. Railway will create a URL like `basicsos-production.up.railway.app`

### Update `BETTER_AUTH_URL`

Set:

```bash
BETTER_AUTH_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

Use the exact URL Railway assigned (no trailing slash).

---

## Step 5: Deploy

1. Save all settings and variables
2. Railway will build and deploy
3. First deploy can take a few minutes (pnpm install, frontend build, server build)
4. Check **Deployments** and **Logs** if needed

---

## Step 6: Run Database Migrations

Migrations run automatically if `DATABASE_URL` is set. If they don’t:

1. Use **Railway CLI** and run:

   ```bash
   railway run pnpm exec drizzle-kit migrate
   ```

2. Or add a one-off job in Railway (if supported) that runs the migrate command with your env.

---

## Step 7: Seed Admin (Optional)

Only for a fresh instance. **Do not run in production if you already have data.**

```bash
railway run --service basicsos pnpm exec tsx src/db/seed.ts
```

Default seed user: `admin@example.com` / `admin123` — change immediately.

---

## Getting Your URLs

| URL Type | Where | Example |
|----------|-------|---------|
| **Web app** | Railway domain for your service | `https://basicsos-production.up.railway.app` |
| **API** | Same URL; paths under `/api/*` | `https://basicsos-production.up.railway.app/api/...` |
| **Health check** | `/health` | `https://basicsos-production.up.railway.app/health` |

Because the web app and API share the same domain, you don’t need to configure CORS or `ALLOWED_ORIGINS` for the browser.

---

## Electron Desktop App

The Electron app connects to your server. When building it:

1. Set `VITE_API_URL` (or `BASICSOS_API_URL`) to your Railway URL before build:
   ```bash
   VITE_API_URL=https://basicsos-production.up.railway.app pnpm run build:electron
   ```
2. Or configure the URL at runtime when launching the Electron app.
3. If the web app and API are on the same URL, the Electron build can use that URL for both.

---

## Custom Domain (Optional)

1. In your Railway service, go to **Settings** → **Networking**
2. Add a custom domain (e.g. `app.yourcompany.com`)
3. Update DNS as instructed (CNAME to Railway)
4. Update `BETTER_AUTH_URL` to the new domain
5. Redeploy if needed

---

## Env Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `${{Postgres.DATABASE_URL}}` |
| `BETTER_AUTH_SECRET` | 32+ char secret for auth | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public URL of your app | `https://app.example.com` |
| `API_KEY_ENCRYPTION_KEY` | 32-byte hex for encrypting API keys | `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | CORS origins (if web/API split) | `https://app.example.com` |
| `BASICSOS_API_URL` | AI gateway (default: basicsos.com) | `https://api.basicsos.com` |
| `SERVER_BASICS_API_KEY` | Org-level AI key fallback | `bos_live_sk_...` |
| `SERVER_BYOK_PROVIDER` | BYOK provider | `openai` / `anthropic` / `gemini` |
| `SERVER_BYOK_API_KEY` | BYOK API key | `sk-...` |
| `PORT` | Server port (Railway sets automatically) | `3001` |

---

## Troubleshooting

### Build fails

- Confirm `Dockerfile.railway` exists and is used
- Ensure `pnpm-lock.yaml` is committed
- Check build logs for memory or timeout issues

### 502 / app not loading

- Check `/health` responds
- Verify `DATABASE_URL` and `BETTER_AUTH_URL` are set
- Run migrations if needed

### Auth / cookies not working

- `BETTER_AUTH_URL` must exactly match the URL users see in the browser (scheme + host)
- Ensure you use `https` in production

### Database connection errors

- Confirm `${{Postgres.DATABASE_URL}}` uses the correct service name
- Check the Postgres service is running and reachable from the BasicsOS service

---

## Alternative: Server-Only Deployment

If you host the web app separately (e.g. Vercel, CDN, or another static host):

1. Deploy only the API using `packages/server` with the original `Dockerfile` (server-only build).
2. Build the web app with:
   ```bash
   VITE_API_URL=https://your-api.railway.app pnpm run build
   ```
3. Deploy `dist/` to your static host.
4. Set `ALLOWED_ORIGINS` on the server to include your web app URL (e.g. `https://app.example.com`).
5. Set `BETTER_AUTH_URL` to your web app URL (where auth redirects).

---

## Summary Checklist

- [ ] Create Railway project from GitHub
- [ ] Add PostgreSQL
- [ ] Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `API_KEY_ENCRYPTION_KEY`
- [ ] Generate domain and set `BETTER_AUTH_URL` to it
- [ ] Deploy and verify `/health`
- [ ] Run migrations
- [ ] (Optional) Seed admin and change password
- [ ] Build Electron app with your server URL for desktop users
