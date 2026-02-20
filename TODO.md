# Basics OS — MVP TODO

Issues identified by codebase audit. Ordered by priority.

---

## P0 — Silent Bugs (Fixed)

- [x] **Wire `registerEmbeddingListener()` + `startEmbeddingWorker()` in `dev.ts`**
  Documents and meetings were never getting embedded. Vector/semantic search returned meaningless results.
  Fixed: `packages/api/src/dev.ts`

- [x] **Wire `registerAutomationListener()` in `dev.ts`**
  Automations were never triggering even when matching events fired.
  Fixed: `packages/api/src/dev.ts`

- [x] **Wire `registerNotificationDispatcher()` in `dev.ts`**
  Notification dispatcher subscriber was dead code.
  Fixed: `packages/api/src/dev.ts`

---

## P1 — Admin Panel Pages Are Static HTML

- [ ] **`/admin/billing` — connect to `billingRouter`**
  Page shows static marketing copy. Backend is fully implemented (`packages/api/src/routers/billing.ts`).
  Needs: show current plan/status, Stripe checkout button (starter/team), customer portal button.
  Procedures: `billing.getSubscription`, `billing.createCheckoutSession`, `billing.createPortalSession`

- [ ] **`/admin/api-keys` — connect to `llmKeysRouter`**
  Page shows static docs. Backend is fully implemented (`packages/api/src/routers/llm-keys.ts`).
  Needs: list keys, create key (show full key once on creation), delete key, set active.
  Procedures: `llmKeys.list`, `llmKeys.create`, `llmKeys.delete`, `llmKeys.setActive`

- [ ] **`/admin/team` — add member list + role management**
  Page only has an invite dialog. No way to see existing members, change roles, or deactivate users.
  Also missing: `adminRouter` has no `listMembers`, `updateRole`, `deactivateUser` procedures.
  Files: `packages/api/src/routers/admin.ts`, `apps/web/src/app/(dashboard)/admin/team/page.tsx`

---

## P1 — Missing Module UIs

- [ ] **Build `/automations` page**
  Router fully implemented (`packages/api/src/routers/automations.ts`), zero UI pages exist.
  Needs: list automations, create automation (trigger type + action chain), enable/disable toggle, run history.
  Procedures: `automations.list`, `automations.create`, `automations.update`, `automations.setEnabled`, `automations.getRuns`

- [ ] **Build `/ai-employees` page**
  Router fully implemented (`packages/api/src/routers/ai-employees.ts`), zero UI pages exist.
  Needs: list jobs, create job (title + instructions), view LLM output, approve/reject output.
  Procedures: `aiEmployees.list`, `aiEmployees.create`, `aiEmployees.approve`, `aiEmployees.reject`

---

## P2 — Broken UX Flows

- [ ] **Meeting live transcription loop is broken**
  Recording sends audio chunks to `meetings.transcribeAudio` → Deepgram returns text → result is **never saved to the DB or shown in real time**.
  The transcript display only shows already-persisted DB rows. Live recording never populates anything.
  Fix: after `transcribeAudio` returns a transcript string, call `meetings.uploadTranscript` (or a new `addTranscriptChunk` mutation) to persist it, then refetch.
  Files: `apps/web/src/app/(dashboard)/meetings/[id]/page.tsx`

- [ ] **Knowledge editor requires Hocuspocus — no graceful fallback**
  `/knowledge/[id]` always connects to `HocuspocusProvider` at `ws://localhost:4001`.
  If the collab server isn't running, the editor loads but never shows "Live" — confusing UX with no error message.
  Fix: handle `onDisconnect`/connection error to show a "Collaboration unavailable — saving locally" notice and allow the editor to function in plain save mode.
  Files: `apps/web/src/app/(dashboard)/knowledge/[id]/page.tsx`

- [ ] **`automation-executor.worker.ts` executes zero actions**
  The worker fetches the automation and logs the action count, then immediately marks the run `completed`.
  No actions from `actionChain` are dispatched.
  Fix: implement action dispatch loop (at minimum: `notify`, `create_task`, `webhook` action types).
  File: `packages/api/src/workers/automation-executor.worker.ts`

- [ ] **CRM deal cards have no click handler — no deal detail page**
  The pipeline Kanban shows `DealCard` components but clicking them does nothing.
  No `/crm/deals/[id]` route exists.
  Fix: add `onClick` navigation to `DealCard`, create a deal detail page.
  Files: `apps/web/src/app/(dashboard)/crm/DealCard.tsx`

- [ ] **CRM companies are invisible in the UI**
  `companies` table, router, and schema all exist. The CRM page only shows contacts and deals — no companies tab.
  Fix: add Companies tab to CRM page.
  File: `apps/web/src/app/(dashboard)/crm/page.tsx`

---

## P2 — Mobile App

- [ ] **Mobile is entirely read-only**
  Every screen shows "Create from the web app." in its empty state.
  At minimum: add create-task and add-contact flows to mobile.
  Files: `apps/mobile/app/(tabs)/tasks/index.tsx`, `apps/mobile/app/(tabs)/crm/index.tsx`

---

## P3 — Minor Fixes

- [ ] **`searchRouter` procedure name mismatch**
  CLAUDE.md and likely some callers reference `trpc.search.global` but the procedure is named `semantic`.
  Fix: rename `semantic` → `global` or add an alias.
  File: `packages/api/src/routers/search.ts`

- [ ] **Onboarding state is not persisted server-side**
  `auth.completeOnboarding` is a no-op mutation. Onboarding completion is stored in localStorage only.
  New users who clear storage or switch browsers will see onboarding again.
  File: `packages/api/src/routers/auth.ts`

- [x] **Invite email inviter name is hardcoded**
  Invite emails always say "A team member invited you". The inviter's name is available in context.
  Fixed: `packages/api/src/routers/auth.ts`

- [ ] **`import.worker.ts` is a complete stub**
  The bulk import worker only logs a warning — no file reading, parsing, or DB insertion.
  Either implement it or remove it from `QUEUE_NAMES` and `dev.ts` to avoid confusion.
  File: `packages/api/src/workers/import.worker.ts`

- [ ] **Admin MCP page uses `pnpm` instead of `bun`**
  The setup instructions on `/admin/mcp` reference `pnpm --filter @basicsos/mcp-company dev`.
  Project uses Bun.
  File: `apps/web/src/app/(dashboard)/admin/mcp/page.tsx`

- [ ] **Desktop download link is a dead env var**
  Settings page "Download Desktop App" points to `/api/desktop` which redirects to `DESKTOP_DOWNLOAD_URL`.
  No build artifact is produced or served. Either build a release pipeline or remove the button.
  File: `apps/web/src/app/(dashboard)/settings/page.tsx`

---

## P3 — Developer Experience (from QOL_IMPROVEMENTS.md)

- [ ] **No `.env.example` file** — new devs have no idea what env vars to set; `bun dev:setup` generates `.env` but fresh clones without running setup are broken silently.

- [ ] **`dev-setup.sh` swallows real errors with `2>/dev/null`** — migration and seed failures show a generic message; the actual postgres error is hidden. Remove `2>/dev/null`.
  File: `scripts/dev-setup.sh:73-76`

- [ ] **`dev-setup.sh` has no Docker daemon preflight** — running without Docker gives a raw daemon error. Add `docker info` check with friendly message.
  File: `scripts/dev-setup.sh:47`

- [ ] **Postgres readiness loop never aborts** — if postgres takes >30s to start (slow machine), all 15 retries exhaust and migration runs against a not-ready DB. Add abort after loop.
  File: `scripts/dev-setup.sh:51-58`

- [ ] **`seed.ts` crashes on double-run** — running seed twice hits duplicate key errors. Add early-exit guard + wrap all inserts in a transaction.
  File: `packages/db/src/seed.ts`

- [ ] **DB pool errors silently swallowed** — missing `DATABASE_URL` causes hanging requests with no log. Replace the empty `pool.on("error")` handler with a real log.
  File: `packages/db/src/client.ts:12-15`

- [ ] **Redis error crashes the entire API process** — if Redis is down, an unhandled `EventEmitter` error kills the server. Add `connection.on("error")` handler to degrade gracefully.
  File: `packages/api/src/workers/queue.ts`

- [ ] **No `BETTER_AUTH_SECRET` startup guard** — running without it signs tokens with a blank secret; sessions silently break across restarts. Add `process.exit(1)` guard at API boot.
  File: `packages/api/src/server.ts`

- [ ] **`REDIS_URL` missing defaults to `localhost:6379` with no warning** — silent failure in production environments.
  File: `packages/api/src/workers/queue.ts`

- [ ] **`CONTRIBUTING.md` and `TESTING_GUIDE.md` use `pnpm` throughout** — project uses Bun. Update all `pnpm` → `bun` references.
  Files: `CONTRIBUTING.md`, `TESTING_GUIDE.md`

- [ ] **Admin MCP page references `@basicsos/mcp-company` npm package** — this package doesn't exist; self-hosters must run the local MCP server directly.
  File: `apps/web/src/app/(dashboard)/admin/mcp/page.tsx`

---

## Notes

- `notification-dispatcher.ts` is wired but only `console.warn`s — it's a stub for future notification routing logic, not broken.
- `OAUTH_ENCRYPTION_KEY` falls back to unencrypted storage if not set — document this clearly for self-hosters.
- Billing, Deepgram, Stripe, and OAuth all degrade gracefully when env vars are absent — this is fine for MVP.
