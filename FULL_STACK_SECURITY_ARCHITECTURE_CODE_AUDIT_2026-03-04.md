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
  - Added strict per-route zod payload schemas for mutable CRM create/update handlers; unknown/invalid fields now fail fast.
  - Added targeted CRM mutation security regression tests:
    - role-gated create enforcement
    - strict payload rejection for unknown fields
    - server-side identity injection (`crmUserId`/`organizationId`) on create
    - hard-delete admin boundary and non-admin deal archive-only behavior
  - Added route tenancy-boundary regression tests for:
    - denied access to foreign views (`/views/view/:viewId/*` ownership/org checks)
    - organization-scoped favorites writes in object-config routes
- In progress:
  - None.
- Remaining:
  - Optional: expand integration depth from unit-style route tests to fuller end-to-end security scenarios.

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
- [x] Replace write allowlists with strict per-route zod schemas for all mutable resources.
- [x] Add integration/security tests for RBAC, tenancy, and destructive boundaries. (Targeted route/security baseline complete)

## Next Sprint Pickup
Start here, in order:
1. **Optional deep integration test expansion**
   - Add full request lifecycle tests with real DB fixtures for multi-step RBAC/tenancy scenarios.
2. **Optional assistant path convergence**
   - Continue consolidating policy/execution paths between `/api/gateway-chat` and `/stream/assistant`.
3. **Operational hardening**
   - Add CI security regression jobs (dependency/SAST + targeted policy tests).

## Executive Summary
This audit has moved from high-risk baseline issues to targeted hardening and consistency work.

Current top priorities:
1. Optional deep integration/e2e security coverage.
2. Optional assistant-path policy convergence.
3. Ongoing operational security automation in CI.

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

### Closed Since Initial Audit
1. Renderer session token exposure path and privileged token IPC.
2. Electron hardening gaps (`sandbox`, navigation allowlisting, trust-boundary tightening).
3. Plaintext API key handling in browser storage and DB.
4. Missing tenant checks in automation AI/CRM tool execution.
5. Missing RBAC/admin gates on sensitive configuration and destructive operations.
6. Missing baseline abuse controls (rate limits) and security headers/CSP middleware.
7. Missing disabled-user enforcement in auth middleware.

### Open Findings (Current)
1. Error response consistency needs a final pass.
- Risk:
  - Potential leakage of internal details in unnormalized catch paths.
- Required:
  - Standardize external error envelopes and keep detailed diagnostics server-side only.

## Architecture Findings

1. Tenancy model ambiguity
- Current behavior is mixed:
  - CRM resources mostly user-scoped (`crm_user_id`).
  - Org columns exist but are not authoritative in many handlers.
- Decision needed:
  - If product intent is org-shared CRM, current user-scoped query model will block collaboration.
  - If intent is one-user workspaces, org membership and invites are overbuilt.

2. Assistant execution surface still has overlap
- Paths:
  - Active paths are `/api/gateway-chat` and `/stream/assistant` (legacy `/assistant` source removed).
- Risk:
  - Duplication, drift, inconsistent tool policy and validation.
- Recommendation:
  - Consolidate into one tool execution service + one policy layer; expose channel-specific wrappers only.

3. Gateway key ownership model is split between client and server
- Key can be set from UI and also passed via header (`X-Basics-API-Key`), causing policy ambiguity.
- Recommendation:
  - Single source of truth: server-side managed key reference.

## Code Quality Findings

1. Type-safety baseline has improved and is passing
- Current state:
  - Server/workspace typecheck is passing per latest implementation status.
- Recommendation:
  - Keep CI gating strict and fail merges on typecheck regressions.

2. Runtime validation coverage remains uneven
- Positive:
  - Strong validation exists in assistant/tool execution pathways.
- Gap:
  - Remaining gap is consistency across non-CRM metadata routes and shared validators.

3. Test coverage exists, but security integration depth is still insufficient
- Positive:
  - Targeted crypto helper tests are present.
- Gap:
  - Need broader route/integration coverage for RBAC, tenancy, and destructive-operation boundaries.

## Electron Industry-Standard Checklist

- Context isolation enabled: `Yes`.
- Sandbox enabled: `Yes`.
- Node integration disabled: `Yes`.
- Preload API least-privilege: improved; token retrieval path removed.
- Remote content loading in privileged window: tightened with stricter navigation allowlisting.
- Navigation/window-open allowlisting: improved; continue periodic review as routes evolve.
- Token handling in renderer: removed for session token flow.
- CSP and security headers: server middleware baseline added.

## Prioritized Remediation Roadmap

### Phase 0 (Completed)
1. Renderer token exposure removed; auth requests proxied via main process where needed.
2. Electron hardening flags enabled and navigation policies tightened.
3. Tenant-scoping and RBAC/security middleware baseline landed.
4. API key encryption-at-rest + rotation support + audit logging baseline implemented.

### Phase 1 (Current)
1. Completed: tenancy-policy unification for metadata/object-config/view boundaries (route-level baseline).
2. Completed: targeted integration/security tests for RBAC, org isolation, and destructive operation controls.

### Phase 2 (Next)
1. Converge assistant execution policy between `/api/gateway-chat` and `/stream/assistant`.
2. Add CI security regression checks (dependency/SAST plus policy-focused route tests).
3. Harden error envelope consistency and logging redaction guarantees.

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
