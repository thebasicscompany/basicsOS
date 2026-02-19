# Basics OS — MVP Blockers

> **Goal:** Someone clones the repo, runs `./scripts/dev-setup.sh`, and has a fully working company OS.
> Tracked in order of severity. ✅ = already fixed, 🔴 = blocks the path, 🟡 = degrades experience.

---

## 🔴 CRITICAL — Will prevent first run or login from working

### 1. ✅ `dev-setup.sh` uses wrong package names
**File:** `scripts/dev-setup.sh`
**Problem:** Every `pnpm --filter` call uses `@basicos/*` instead of `@basicsos/*`. Packages are named `@basicsos/shared`, `@basicsos/db`, etc. The setup script would silently produce zero output (pnpm finds no matching package and exits 0).
**Symptom:** Build step appears to succeed but no packages are actually built. Migration and seed steps then fail because `packages/*/dist/` is empty.
**Fix:** Rename all `@basicos/` → `@basicsos/` in setup script — also fix the terminal instructions at the bottom.
**Status:** ✅ Fixed

---

### 2. ✅ Generated `.env` is missing `BETTER_AUTH_URL`
**File:** `scripts/dev-setup.sh`
**Problem:** The auto-generated `.env` includes `BETTER_AUTH_SECRET` and `NEXT_PUBLIC_APP_URL` but not `BETTER_AUTH_URL`. Better Auth needs this to build redirect URLs for OAuth callbacks. Without it, it defaults to `http://localhost:3000` from `NEXT_PUBLIC_APP_URL`, but only via `??` fallback — any difference between the two in production silently breaks auth.
**Fix:** Add `BETTER_AUTH_URL=http://localhost:3000` to the generated `.env` block.
**Status:** ✅ Fixed

---

### 3. ✅ Demo login fails — seed doesn't create `accounts` rows
**File:** `packages/db/src/seed.ts`
**Problem:** The seed inserts users into the `users` table but never creates rows in the `accounts` table. Better Auth stores password hashes in `accounts` with `providerId: "credential"`. When a user tries to sign in with email/password, Better Auth queries `accounts` first — finding nothing, it returns "Invalid credentials".
**Symptom:** Cloner runs `dev-setup.sh`, opens `http://localhost:3000`, enters `admin@acme.example.com` + any password → "Invalid credentials". Nothing works.
**Fix:** After inserting each user, also insert into `accounts`:
```ts
import { hashPassword } from "better-auth/crypto";
// ...
const passwordHash = await hashPassword("password");

await db.insert(accounts).values({
  accountId: admin.id,
  providerId: "credential",
  userId: admin.id,
  password: passwordHash,
});
// same for member user
```
**Status:** ✅ Fixed

---

### 4. ✅ Both Dockerfiles use wrong package names (same typo as setup script)
**Files:** `apps/web/Dockerfile`, `packages/api/Dockerfile`
**Problem:** The builder stage in both Dockerfiles runs:
```
pnpm --filter @basicos/shared build
pnpm --filter @basicos/db build
...
```
These are the same `@basicos/*` → `@basicsos/*` typos. Running `docker-compose -f docker-compose.prod.yml up` will fail silently in the builder stage — all packages produce empty `dist/` dirs, and the final `CMD` crashes at startup.
**Fix:** Rename all `@basicos/` → `@basicsos/` in both Dockerfiles.
**Status:** ✅ Fixed

---

### 5. ✅ Web Docker image crashes at runtime — missing package dists in runner stage
**File:** `apps/web/Dockerfile`
**Problem:** The runner stage only copies `.next/`, `public/`, `package.json`, and `node_modules/`. In a pnpm monorepo, `node_modules/@basicsos/db` etc. are symlinks pointing to `packages/db/` in the repo root — but the runner stage never copies those directories. At runtime, `require('@basicsos/db')` resolves to a broken symlink → crash.
The API Dockerfile handles this correctly (explicitly copies each `packages/*/dist`). The web Dockerfile does not.
**Fix:** Add to runner stage:
```dockerfile
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/ui/dist ./packages/ui/dist
```
**Status:** ✅ Fixed

---

## 🟡 IMPORTANT — Works but feature is broken or misleading

### 6. ✅ `dev-setup.sh` login hint says "any password"
**Problem:** Footer of setup script said `Password: (any password — auth uses Better Auth)`. This implies passwordless auth. With the accounts fix above, the password is `password`.
**Status:** ✅ Fixed (now says `Password: password`)

---

### 7. ✅ Automation executor worker never starts
**File:** `packages/api/src/dev.ts`
**Problem:** `startAutomationExecutorWorker` is imported in its file but never registered in `dev.ts`. The automations feature (full schema, router, UI) is complete — but no automation ever executes because the worker queue is never consumed.
**Fix:**
```ts
import { startAutomationExecutorWorker } from "./workers/automation-executor.worker.js";
// ...
startAutomationExecutorWorker();
```
**Status:** ✅ Fixed

---

### 8. ✅ "Admin" nav link visible to all users regardless of role
**File:** `apps/web/src/app/(dashboard)/NavClient.tsx`
**Problem:** `NAV_ITEMS` is a static array with the "Admin" link always included. Every member sees `/admin/team`, `/admin/usage`, `/admin/security` in the sidebar. The routes themselves are protected server-side (via `adminProcedure`), but the nav link should be hidden for non-admins.
**Fix:** Filter `NAV_ITEMS` based on `user?.role`:
```ts
const visibleItems = NAV_ITEMS.filter(item =>
  item.href.startsWith("/admin") ? user?.role === "admin" : true
);
```
**Status:** ✅ Fixed

---

### 9. 🟡 `apps/web/.env.local` has placeholder values — needed for `next build` only
**File:** `apps/web/.env.local` (created during build fixes)
**Problem:** This file was created with placeholder values (`BETTER_AUTH_SECRET=build-time-placeholder...`, `DATABASE_URL=postgresql://localhost:5432/basicsos`) so that Next.js can complete its static analysis pass without failing. These are not real values — they only prevent module-load errors during build.
**Note:** `.env.local` is in `.gitignore` — this file should NOT be committed. For production Docker builds, the real env is injected via `docker-compose.prod.yml`. For local dev, the root `.env` (generated by `dev-setup.sh`) is used.
**Status:** 🟡 Working but should be documented — consider moving build-time guards to check if actually running (not just importing).

---

## 🟡 NICE TO HAVE — Degrades AI/advanced feature quality

### 10. 🟡 MCP `search_knowledge_base` returns IDs and titles, not content
**File:** `apps/mcp/company/src/tools/knowledge-base.ts`
**Problem:** The MCP tool that Claude uses to search your knowledge base returns `{ id, title, score }` per result — no actual document content. Claude can't read your docs through MCP without a separate `get_document` call.
**Fix:** Join with document content in the query, return `contentText` (plain text extracted from `contentJson`).
**Status:** 🟡 Not fixed

---

### 11. 🟡 Desktop overlay `AskTab` uses blocking `/assistant/chat` instead of streaming
**File:** `apps/desktop/src/renderer/src/components/AskTab.tsx`
**Problem:** The overlay's AI chat calls the non-streaming `trpc.assistant.chat` procedure. The web app's assistant page uses the SSE streaming endpoint (`/stream/assistant`) which yields tokens in real time. The desktop overlay feels slow and shows no typing effect.
**Fix:** Wire `AskTab` to the SSE streaming endpoint (same pattern as `apps/web/src/app/(dashboard)/assistant/page.tsx`).
**Status:** 🟡 Not fixed

---

### 12. 🟡 Engineer MCP `get_team_context` returns stub data
**File:** `apps/mcp/engineer/src/resources/team-context.ts`
**Problem:** The engineer MCP server (the one Claude Code connects to for project context) has a `team-context` resource that returns hardcoded placeholder text instead of querying the actual database.
**Fix:** Wire to `trpc.knowledge.list` or the DB directly, same as other company MCP tools.
**Status:** 🟡 Not fixed

---

## Summary

| # | Severity | File | Status |
|---|----------|------|--------|
| 1 | 🔴 Critical | `scripts/dev-setup.sh` — wrong package names | ✅ Fixed |
| 2 | 🔴 Critical | `scripts/dev-setup.sh` — missing `BETTER_AUTH_URL` | ✅ Fixed |
| 3 | 🔴 Critical | `packages/db/src/seed.ts` — no `accounts` rows | ✅ Fixed |
| 4 | 🔴 Critical | `apps/web/Dockerfile` + `packages/api/Dockerfile` — wrong package names | ✅ Fixed |
| 5 | 🔴 Critical | `apps/web/Dockerfile` — runner missing package dists | ✅ Fixed |
| 6 | 🟡 | `scripts/dev-setup.sh` — misleading login hint | ✅ Fixed |
| 7 | 🔴 Important | `packages/api/src/dev.ts` — automation worker never starts | ✅ Fixed |
| 8 | 🔴 Important | `apps/web/src/app/(dashboard)/NavClient.tsx` — admin link to all users | ✅ Fixed |
| 9 | 🟡 | `apps/web/.env.local` — placeholder only, don't commit | 🟡 Note |
| 10 | 🟡 | MCP search returns no content | 🟡 Nice to have |
| 11 | 🟡 | Desktop overlay non-streaming chat | 🟡 Nice to have |
| 12 | 🟡 | Engineer MCP stub data | 🟡 Nice to have |

**All critical + important blockers fixed. Remaining items (10-12) are quality improvements for AI features.**
