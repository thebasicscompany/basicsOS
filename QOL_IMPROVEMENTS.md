# QOL Improvements

Developer experience improvements for people cloning and running the starterpack.
Ordered by impact. ✅ = done, 🔴 = high impact, 🟡 = medium, 🔵 = low/polish.

---

## 🔴 HIGH IMPACT

### 1. No `.env.example` file
**What the dev sees:** Clones the repo, skips `dev:setup`, has no idea what env vars to set. Tries to run the app — it silently fails at login or on the first DB query with no hint about which variable is missing.
**Fix:** Create `/.env.example` with every variable annotated as required vs optional. This is a single file that removes 80% of "why doesn't this work" confusion for new devs.

---

### 2. `dev-setup.sh` — actual errors are hidden by `2>/dev/null`
**File:** `scripts/dev-setup.sh:73-76`
**What the dev sees:** Migration or seed fails for a real reason (wrong schema, pgvector missing, corrupted state). They see: `"Migration failed — database may already be initialized"` — the actual postgres error is gone.
```bash
pnpm db:migrate 2>/dev/null || warn "Migration failed..."   # ← kills the real error
pnpm db:seed 2>/dev/null || warn "Seed failed..."           # ← same
```
**Fix:** Remove `2>/dev/null`. Let errors surface. Use `|| true` only if you genuinely want to ignore a known harmless failure (already-applied migrations).

---

### 3. `dev-setup.sh` — no Docker preflight check
**File:** `scripts/dev-setup.sh:47`
**What the dev sees:** Runs `dev-setup.sh` on a fresh machine without starting Docker Desktop. Gets: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock` — a raw Docker error with no guidance.
**Fix:** Add before `docker-compose up -d`:
```bash
docker info >/dev/null 2>&1 || { echo "ERROR: Docker is not running. Start Docker Desktop and re-run."; exit 1; }
```

---

### 4. `dev-setup.sh` — Postgres readiness loop falls through silently
**File:** `scripts/dev-setup.sh:51-58`
**What the dev sees:** Docker is up but Postgres takes longer than 30 seconds (e.g., first-time volume init on a slow machine). The loop exhausts all 15 retries, prints nothing, and runs `pnpm db:migrate` against a not-ready database. The migration fails with a cryptic postgres error.
**Fix:** After the loop, check if postgres actually became ready and abort if not:
```bash
docker-compose exec -T postgres pg_isready -U basicos >/dev/null 2>&1 \
  || { echo "ERROR: PostgreSQL did not become ready in time. Try running docker-compose up -d again."; exit 1; }
```

---

### 5. `seed.ts` — running twice crashes with duplicate key errors
**File:** `packages/db/src/seed.ts:29`
**What the dev sees:** Runs `pnpm db:seed` a second time (e.g., re-ran `dev-setup.sh`, or first run crashed partway through). Gets a postgres unique constraint violation. The dev-setup script swallows this with `"Seed failed — database may already have data"` — leaving the dev unsure whether they have a clean database or a half-seeded corrupt one.
**Fix:** Wrap all inserts in a transaction and add an early-exit guard:
```ts
// Check if already seeded
const existing = await db.select().from(tenants).limit(1);
if (existing.length > 0) {
  console.log("Database already seeded — skipping.");
  return;
}
await db.transaction(async (tx) => {
  // all inserts here
});
```

---

### 6. Seed has no transaction — partial failure leaves corrupt state
**File:** `packages/db/src/seed.ts:26-160`
**What the dev sees:** Seed starts, crashes halfway through (e.g., process killed, or a schema mismatch on documents). The tenant and users exist but no CRM/tasks/docs data does. Next `db:seed` fails with a duplicate key on tenant. Dev is now stuck with a broken database and no recovery path other than manually dropping tables.
**Fix:** Same as above — wrap all inserts in `db.transaction()`.

---

### 7. `db/client.ts` — pool errors silently swallowed when `DATABASE_URL` is missing
**File:** `packages/db/src/client.ts:12-15`
**What the dev sees:** Forgot to set `DATABASE_URL`. Makes a request. Gets a hanging request or a generic tRPC `INTERNAL_SERVER_ERROR` in the browser — nothing in the server logs pointing to a missing env var.
```ts
pool.on("error", () => {
  // swallow pool-level errors
});
```
**Fix:** Log a clear message instead of silently swallowing:
```ts
if (!connectionString) {
  console.warn("[db] WARNING: DATABASE_URL is not set — all queries will fail.");
}
pool.on("error", (err) => {
  console.error("[db] Pool error (check DATABASE_URL):", err.message);
});
```

---

### 8. Redis error crashes the entire API process
**File:** `packages/api/src/workers/queue.ts:8-13`
**What the dev sees:** Starts the API but forgot to start Docker (Redis is down). The entire API process crashes with `Error: connect ECONNREFUSED 127.0.0.1:6379` — an unhandled `EventEmitter` error. The API itself (tRPC, auth, DB queries) would have been fine, but it's gone.
**Fix:** Add an error handler so Redis failure degrades gracefully instead of crashing everything:
```ts
connection.on("error", (err) => {
  console.error("[queue] Redis connection error (background workers unavailable):", err.message);
});
```

---

### 9. `pnpm dev` has no `.env` preflight check
**File:** `package.json`
**What the dev sees:** Clones the repo, runs `pnpm dev` directly (common pattern from other projects). No `.env` exists. The web app starts fine, but the API crashes or hangs on the first query. The dev spends time debugging what looks like an API bug when the real issue is a missing `.env` file.
**Fix:** Add a `predev` script that checks for `.env` and warns:
```json
"predev": "node -e \"require('fs').existsSync('.env') || (console.error('ERROR: .env file not found. Run: cp .env.example .env'), process.exit(1))\""
```

---

### 10. `NEXT_PUBLIC_API_URL` missing goes completely unnoticed
**File:** `apps/web/next.config.ts`
**What the dev sees:** Sets up `.env` but forgets `NEXT_PUBLIC_API_URL`. Every tRPC call in the browser goes to the URL string `"undefined/trpc/..."` — a fetch error in devtools with no indication that an env var is the root cause. Very confusing.
**Fix:** Add a build/boot warning in `next.config.ts`:
```ts
const requiredClientEnv = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_URL"];
for (const key of requiredClientEnv) {
  if (!process.env[key]) {
    console.warn(`[next.config] WARNING: ${key} is not set — tRPC calls will fail.`);
  }
}
```

---

## 🟡 MEDIUM IMPACT

### 11. API worker startup crashes the whole process if Redis is down
**File:** `packages/api/src/dev.ts:15-20`
**What the dev sees:** Workers are registered at startup before the HTTP server starts. If any worker throws (e.g., Redis is down), the API server never starts. The dev gets a crash at startup with no indication that the HTTP server itself would have been fine.
**Fix:** Wrap worker starts in try/catch so the API boots even if workers fail:
```ts
try { startMeetingProcessorWorker(); } catch (e) { console.warn("[worker] meeting-processor failed to start:", e); }
```

---

### 12. Port conflict produces a raw Node.js stack trace
**File:** `packages/api/src/dev.ts:24`
**What the dev sees:** Port 3001 is already in use (e.g., previous process didn't shut down cleanly). Gets a full `Error: listen EADDRINUSE :::3001` Node stack trace with no guidance.
**Fix:** Catch EADDRINUSE specifically and print a friendly message:
```ts
serve(...).on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Kill the process using it or set PORT=<other>.`);
    process.exit(1);
  }
  throw err;
});
```

---

### 13. `dev-setup.sh` — `BETTER_AUTH_SECRET` can be silently empty
**File:** `scripts/dev-setup.sh:18`
**What the dev sees:** On a machine without `openssl` or `node` on PATH (rare but possible in Docker or CI), `AUTH_SECRET` becomes an empty string. The `.env` is created with `BETTER_AUTH_SECRET=` (blank). Auth fails at runtime when signing tokens — with no env-level warning.
**Fix:** Validate `AUTH_SECRET` after the generation attempt:
```bash
[ -z "$AUTH_SECRET" ] && { echo "ERROR: Could not generate AUTH_SECRET. Install openssl or node."; exit 1; }
```

---

### 14. `queue.ts` — silent fallback to `localhost:6379` with no warning
**File:** `packages/api/src/workers/queue.ts:4`
**What the dev sees:** In production (Railway, Fly.io), forgot to set `REDIS_URL`. Workers silently try to connect to `localhost:6379` — which doesn't exist — and every queue job fails indefinitely. No log entry mentions the missing env var.
**Fix:**
```ts
if (!process.env["REDIS_URL"]) {
  console.warn("[queue] WARNING: REDIS_URL is not set — falling back to localhost:6379");
}
```

---

### 15. `docker-compose.yml` healthcheck ignores `POSTGRES_USER` variable
**File:** `docker-compose.yml:13`
**What the dev sees:** Customizes `POSTGRES_USER` in their `.env`. The healthcheck keeps reporting unhealthy because it still checks for user `basicos` — even though Postgres is running fine with their custom username.
```yaml
test: ["CMD-SHELL", "pg_isready -U basicos"]  # ← hardcoded
```
**Fix:**
```yaml
test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-basicos}"]
```

---

### 16. No `BETTER_AUTH_SECRET` guard at API server startup
**File:** `packages/api/src/server.ts`
**What the dev sees:** Starts the API without `BETTER_AUTH_SECRET`. Auth initialises with a blank secret — sessions appear to work (tokens are signed and accepted) but any session from a different server instance or restart is rejected, causing mysterious "logged out" behavior with no error.
**Fix:** Add at the top of `server.ts`:
```ts
if (!process.env["BETTER_AUTH_SECRET"]) {
  console.error("FATAL: BETTER_AUTH_SECRET is not set. Auth will not work correctly.");
  process.exit(1);
}
```

---

## 🔵 LOW / POLISH

### 17. `console.warn` used for the "server is ready" message
**File:** `packages/api/src/dev.ts:25`
The API startup success message uses `console.warn` which outputs in yellow/stderr in most terminals and CI systems. It's semantically a success message, not a warning.
**Fix:** Change to `console.log`.

---

### 18. Middleware `__session` fallback cookie is undocumented
**File:** `apps/web/src/middleware.ts:24`
The middleware checks for `better-auth.session_token` OR `__session`. The `__session` fallback has no comment explaining where it comes from (legacy? Firebase?). A developer debugging auth will be confused why half-broken sessions can still pass the middleware check.
**Fix:** Add a comment, or remove the fallback if it's dead code.

---

### 19. `docker-compose down -v` silently destroys all data
**File:** `docker-compose.yml`
The standard "reset" command `docker-compose down -v` deletes both the Postgres volume (all your data) and the Redis volume (all pending queue jobs). There is no warning in the README, setup script, or compose file.
**Fix:** Add a comment in `docker-compose.yml`:
```yaml
volumes:
  postgres_data:  # WARNING: `docker-compose down -v` will delete all data
  redis_data:
```
And note it in the README troubleshooting section.

---

## Summary Table

| # | File | Issue | Priority |
|---|------|-------|----------|
| 1 | *(missing)* | No `.env.example` file | 🔴 High |
| 2 | `scripts/dev-setup.sh:73-76` | `2>/dev/null` hides real errors | 🔴 High |
| 3 | `scripts/dev-setup.sh:47` | No Docker daemon preflight check | 🔴 High |
| 4 | `scripts/dev-setup.sh:51-58` | Postgres readiness loop never aborts | 🔴 High |
| 5 | `packages/db/src/seed.ts:29` | Double-seed crashes with duplicate key | 🔴 High |
| 6 | `packages/db/src/seed.ts:26-160` | No transaction — partial seed corrupts DB | 🔴 High |
| 7 | `packages/db/src/client.ts:12-15` | Pool errors silently swallowed | 🔴 High |
| 8 | `packages/api/src/workers/queue.ts:8-13` | Redis error crashes entire API process | 🔴 High |
| 9 | `package.json` | `pnpm dev` has no `.env` preflight | 🔴 High |
| 10 | `apps/web/next.config.ts` | Missing `NEXT_PUBLIC_API_URL` goes unnoticed | 🔴 High |
| 11 | `packages/api/src/dev.ts:15-20` | Worker startup crash kills API server | 🟡 Medium |
| 12 | `packages/api/src/dev.ts:24` | Port conflict shows raw stack trace | 🟡 Medium |
| 13 | `scripts/dev-setup.sh:18` | `BETTER_AUTH_SECRET` can be silently empty | 🟡 Medium |
| 14 | `packages/api/src/workers/queue.ts:4` | Silent `localhost:6379` fallback, no warning | 🟡 Medium |
| 15 | `docker-compose.yml:13` | Healthcheck hardcodes `basicos` username | 🟡 Medium |
| 16 | `packages/api/src/server.ts` | No `BETTER_AUTH_SECRET` guard at startup | 🟡 Medium |
| 17 | `packages/api/src/dev.ts:25` | `console.warn` for success message | 🔵 Low |
| 18 | `apps/web/src/middleware.ts:24` | `__session` fallback undocumented | 🔵 Low |
| 19 | `docker-compose.yml` | `down -v` silently destroys all data | 🔵 Low |
