# Full Audit: Security, Architecture, Code Quality
Date: 2026-03-04
Repo: `basicsOSnew`
Scope: Electron desktop app, React frontend, Hono/Drizzle backend, AI/tooling/automation, auth/tenancy flows

## Status Update (Implemented So Far)
- Done:
  - Electron hardening is in place (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`) with stricter navigation allowlisting.
  - Renderer session-token exposure path was removed; overlay now uses main-process proxy requests for authenticated calls.
  - Browser `localStorage` API key persistence was removed (key is in-memory only on client).
  - Central auth middleware now enforces disabled-user denial.
  - RBAC enforcement added across sensitive routes (including hard-delete restrictions and admin-gated config paths).
  - Security middleware added in server app (rate limiting + security headers/CSP).
  - Airtable route was removed/deprecated from active server routing.
  - Server and workspace typecheck now pass; tests and production build pass.
  - Deprecated `/assistant` route source was removed; active assistant paths are now `/api/gateway-chat` and `/stream/assistant`.
  - Generic CRM create/update handlers now enforce explicit writable field allowlists (mass-assignment hardening baseline).
  - Views now persist and verify `organization_id` consistently with the current user's org.
  - Favorites now persist and filter by `organization_id`.
  - Automation AI action queries/mutations now include organization scoping guards.
  - Automation CRM action executor now resolves `organization_id` and enforces org-scoped checks for task/note/deal operations.
  - API key at-rest protection baseline implemented:
    - Added encrypted storage (`basics_api_key_enc`) + deterministic hash (`basics_api_key_hash`) in `crm_users`.
    - API key writes now encrypt and hash; reads decrypt with legacy plaintext fallback.
    - Added key-rotation decrypt support via `API_KEY_ENCRYPTION_KEY_PREVIOUS` (comma-separated prior keys).
    - DB migration `0018_api_key_encryption.sql` applied.
  - Audit logging baseline is now implemented for privileged/configuration and destructive CRM mutations.
  - Added targeted server tests for API key crypto helpers (round-trip encryption, rotation decrypt, hashing, legacy fallback).
- In progress:
  - Final tenancy cleanup for object metadata tables and cross-route policy unification.
- Remaining:
  - Replace generic CRM mass-assignment allowlists with strict per-route zod schemas for all mutable resources.
  - Expand end-to-end integration/security test coverage (RBAC, tenancy, destructive action boundaries).

## Remediation Checklist (Tracked)
- [x] Remove renderer session token exposure and proxy auth calls via main process.
- [x] Electron hardening flags and stricter navigation allowlisting.
- [x] Remove browser `localStorage` API key persistence.
- [x] Enforce disabled-user denial in auth middleware.
- [x] Add RBAC enforcement on sensitive/admin routes.
- [x] Add security middleware (headers + rate limiting).
- [x] Remove deprecated Airtable route.
- [x] Remove deprecated `/assistant` route source.
- [x] Add CRM write allowlists (mass-assignment baseline hardening).
- [x] Enforce `organization_id` consistency in views and favorites.
- [x] Tenant-scope AI automation tools.
- [x] Tenant-scope CRM automation action executor.
- [x] Encrypt gateway keys at rest (`basics_api_key_enc`) + key hash (`basics_api_key_hash`).
- [x] Add API key decrypt rotation support (`API_KEY_ENCRYPTION_KEY_PREVIOUS`).
- [x] Add audit logging baseline for privileged/config/destructive mutations.
- [x] Add server crypto helper tests.
- [ ] Replace write allowlists with strict per-route zod schemas for all mutable resources.
- [ ] Add integration/security tests for RBAC, tenancy, and destructive boundaries.

## Next Sprint Pickup
Start here, in order:
1. **Per-route zod schemas for mutable CRM routes**
   - Add explicit create/update schemas per resource in `packages/server/src/routes/crm/handlers/*`.
   - Remove implicit broad payload acceptance; keep/align allowlists only as defense-in-depth.
2. **Integration/security test suite expansion**
   - Add route-level tests for: org isolation, role-gated mutations, and hard-delete admin-only behavior.
   - Add regression tests for views/object-config tenancy boundaries.
3. **Close remaining audit doc drift**
   - Update stale narrative sections (`Executive Summary`, `Code Quality Findings`, checklist notes) that still mention already-fixed items.

## Executive Summary
The product direction is strong, but there are several high-risk gaps before this should be considered production-grade in a multi-tenant commercial environment.

Top priorities:
1. Harden Electron trust boundary (currently too permissive for remote-navigation/token-exposure threat model).
2. Remove plaintext secret handling (API keys in localStorage + DB plaintext).
3. Enforce strict server-side authorization + schema validation on all mutable routes.
4. Decide and enforce one tenancy model consistently (org-wide shared vs per-user private).
5. Restore server type-safety baseline (package-level typecheck currently failing).

## System Map (End-to-End)
- Desktop shell: Electron main/preload + two renderer surfaces (main app + overlay).
- Frontend: React + TanStack Query + Better Auth client cookie session.
- Backend: Hono API with Better Auth, Drizzle/Postgres.
- AI:
  - `/api/gateway-chat` and `/stream/assistant` execute CRM tools server-side.
  - Automation agent can run tool calls from workflow actions.
- Data:
  - CRM core tables scoped by `crm_user_id` (plus new `organization_id` columns).
  - Memory/thread tables present.

## Security Findings

### Critical
1. Electron renderer can retrieve session token and trigger privileged IPC
- Evidence:
  - `get-session-token` exposed via IPC: `src/main/index.ts:180-189`
  - preload exposes `getSessionToken` globally: `src/preload/index.ts:37-39`
- Impact:
  - Any XSS or untrusted content in renderer can steal session token and call backend as user.
- Recommendation:
  - Remove session-token exposure to renderer entirely.
  - Move voice API calls behind main-process IPC proxy so renderer never sees auth tokens.

2. Electron remote navigation + preload bridge + disabled sandbox
- Evidence:
  - `sandbox: false` in both windows: `src/main/index.ts:80-83`, `122-125`
  - renderer can request arbitrary `http` URL load: `src/main/index.ts:237-244`
- Impact:
  - If renderer is compromised, attacker can navigate main window and potentially abuse bridge surface.
- Recommendation:
  - Set `sandbox: true`, keep `contextIsolation: true`, ensure `nodeIntegration: false`.
  - Block arbitrary URL navigation from renderer; enforce strict allowlist.
  - Add `will-navigate` protections on main window too.

3. Secrets handled in plaintext (client + server)
- Evidence:
  - API key stored in `localStorage`: `src/providers/GatewayProvider.tsx:63-65`, `95-96`
  - API key stored plaintext in DB: `packages/server/src/db/schema/crm_users.ts:26`
- Impact:
  - Easy exfiltration via XSS/local compromise; DB leak reveals all customer gateway keys.
- Recommendation:
  - Stop storing keys in browser storage.
  - Encrypt at rest on server (KMS-backed envelope encryption), rotate support, audit logs.
  - Prefer per-org server-side credential references over raw key material.

4. AI automation agent reads/writes data without tenant checks in multiple tools
- Evidence:
  - `getContacts`/`getDeals` queries not scoped to `crmUserId`: `packages/server/src/lib/automation-actions/ai-agent.ts:44-67`
  - `updateDeal` missing ownership guard: `packages/server/src/lib/automation-actions/ai-agent.ts:92-97`
- Impact:
  - Cross-tenant/cross-user data leakage and mutation risk.
- Recommendation:
  - Enforce `crmUserId`/`organizationId` predicates on every tool query/mutation.
  - Add centralized authorization guard used by all tool executors.

### High
5. Object config routes allow broad authenticated mutation with no admin check
- Evidence:
  - Global object config read/update, no admin gate: `packages/server/src/routes/object-config.ts:20-57`, `165-216`, `223-305`
- Impact:
  - Any authenticated user can modify object metadata/overrides for all users.
- Recommendation:
  - Restrict to admin role and scope by organization.

6. Tenancy fields exist but not consistently enforced
- Evidence:
  - `organization_id` added across schema, but many routes filter only by `crmUserId`.
  - views inserts omit `organizationId`: `packages/server/src/routes/views.ts:229-237`, `271-278`
- Impact:
  - Inconsistent isolation and future migration risk.
- Recommendation:
  - Pick one model and apply it uniformly at query layer:
    - Org-shared data: always filter by `organization_id`, optional per-user ownership columns.
    - User-private data: enforce `crm_user_id` everywhere and keep org as metadata only.

7. Generic CRM create/update handlers use mass-assignment style writes
- Evidence:
  - Body is forwarded into table insert/update with minimal allowlist checks: `packages/server/src/routes/crm/handlers/create.ts:31-41`, `update.ts:46-66`
- Impact:
  - Client can attempt unauthorized field writes (system fields, hidden flags, foreign keys).
- Recommendation:
  - Per-resource zod schemas for create/update + explicit writable field allowlists.

8. No rate limits / abuse controls on sensitive endpoints
- Evidence:
  - No rate limiting middleware in app bootstrap: `packages/server/src/app.ts`
- Impact:
  - Brute-force/abuse risk on signup, login, invites, AI-heavy endpoints.
- Recommendation:
  - Add IP/user rate limiting + per-route quotas + invite creation throttles.

### Medium
9. Missing standard security headers and CSP hardening
- Evidence:
  - No CSP/security header middleware in server app: `packages/server/src/app.ts`
  - HTML entry points have no CSP meta: `src/renderer/index.html`, `src/renderer/overlay.html`
- Recommendation:
  - Add strict headers (`CSP`, `X-Frame-Options`, `Referrer-Policy`, etc.).
  - For Electron, prefer browserWindow `contentSecurityPolicy` and block remote code.

10. `disabled` user flag is not enforced in auth checks
- Evidence:
  - Field exists: `packages/server/src/db/schema/crm_users.ts:25`
  - No enforcement usage in route/middleware.
- Impact:
  - Disabled accounts can still access if session exists.
- Recommendation:
  - Enforce disabled check in auth middleware after session resolution.

11. Error handling can leak internals
- Evidence:
  - Raw error message returns in some routes: `object-config.ts` catch blocks.
- Recommendation:
  - Return stable generic errors externally; log internal details server-side with redaction.

## Architecture Findings

1. Tenancy model ambiguity
- Current behavior is mixed:
  - CRM resources mostly user-scoped (`crm_user_id`).
  - Org columns exist but are not authoritative in many handlers.
- Decision needed:
  - If product intent is org-shared CRM, current user-scoped query model will block collaboration.
  - If intent is one-user workspaces, org membership and invites are overbuilt.

2. Two assistant stacks with overlapping responsibilities
- Paths:
  - `/assistant` and `/api/gateway-chat` and `/stream/assistant`
- Risk:
  - Duplication, drift, inconsistent tool policy and validation.
- Recommendation:
  - Consolidate into one tool execution service + one policy layer; expose channel-specific wrappers only.

3. Gateway key ownership model is split between client and server
- Key can be set from UI and also passed via header (`X-Basics-API-Key`), causing policy ambiguity.
- Recommendation:
  - Single source of truth: server-side managed key reference.

## Code Quality Findings

1. Server package type-safety baseline is currently broken
- Evidence:
  - `pnpm --filter @basics-os/server typecheck` fails with many errors.
- Impact:
  - Regression risk, weak refactor confidence.
- Recommendation:
  - Block merges on server typecheck.
  - Fix import extension drift, route typing, schema typing, SDK typing mismatches.

2. Inconsistent runtime validation coverage
- Positive:
  - Good zod validation in `gateway-chat` tool execution path.
- Gap:
  - Generic CRM handlers and views/object-config endpoints still accept broad unvalidated payloads.

3. Testing coverage is effectively absent
- Evidence:
  - No `*.test.ts(x)` files found in app/server packages.
- Recommendation:
  - Minimum baseline:
    - auth and tenancy authorization tests
    - CRUD authorization tests
    - tool execution contract tests
    - Electron IPC contract tests (preload surface)

## Electron Industry-Standard Checklist

- Context isolation enabled: likely yes (default), but should be explicit in `webPreferences`.
- Sandbox enabled: **No** (`sandbox: false`) -> fix.
- Node integration disabled: likely default false, but should be explicit.
- Preload API least-privilege: **No** (exposes session token retrieval + broad commands).
- Remote content loading in privileged window: **Partially present** (`navigate-main` allows http URLs).
- Navigation/window-open allowlisting: partial; overlay has guard, main window weaker.
- Token handling in renderer: **Not recommended** currently exposed.
- CSP and security headers: **Missing/insufficient**.

## Prioritized Remediation Roadmap

### Phase 0 (Immediate)
1. Remove `getSessionToken` from preload and route all authenticated overlay requests through main-process IPC.
2. Set explicit Electron hardening flags (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`).
3. Block arbitrary URL navigation from renderer IPC; allowlist app routes only.
4. Tenant-scope all AI automation tools.

### Phase 1 (Short)
1. Enforce per-route zod schemas + field allowlists for all write endpoints.
2. Add admin/organization checks to object-config and related metadata routes.
3. Add security middleware (headers + rate limiting).
4. Enforce `disabled` user checks centrally.

### Phase 2 (Stabilization)
1. Resolve server typecheck failures and enforce CI gate.
2. Introduce integration tests for auth/tenancy/tooling.
3. Standardize one assistant/tool execution backend and deprecate duplicates.

### Phase 3 (Hardening/Compliance)
1. Encrypt gateway API keys at rest (KMS) and remove browser storage copy.
2. Add audit logging for admin/config mutations and tool writes.
3. Add security regression checks in CI (SAST/dependency audit).

## Open Questions (Need Your Decisions)
1. Should CRM data be shared org-wide (all users in org see same contacts/deals), or remain user-private?
2. Should gateway API key be one per organization, or one per user?
3. For Electron, do you want to support loading any remote page inside app windows, or strictly local app routes only?
4. Are object/view schema changes intended to be admin-only controls?
5. Do you want to keep both `/assistant` and `/api/gateway-chat` long-term, or converge to one path?

## What Is Already Good
- Clear package boundaries (app/server/shared/automation/voice).
- Better Auth session model is integrated across web + overlay channels.
- Drizzle ORM reduces SQL injection risk in most CRUD paths.
- Tool execution shifted server-side for key assistant flows (good direction).
