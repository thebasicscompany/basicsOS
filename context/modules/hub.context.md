# Hub Module Context

## Overview
The Hub module provides a centralized directory and integration center for Basics OS tenants. It exposes a tRPC router at `packages/api/src/routers/hub.ts` mounted as `hub` on the `appRouter`.

## Structure
The `hubRouter` provides two main areas of functionality:
- **Hub Links** — tenant-scoped bookmarks/shortcuts with title, URL, icon, category, and position ordering
- **Integrations** — third-party service connections (Slack, Google Drive, GitHub) with OAuth stub support

## Procedures

### Hub Links
- `listLinks` — `protectedProcedure` query returning all links for the tenant, ordered by position
- `createLink` — `adminProcedure` mutation inserting a new link with title, URL, optional icon, category, and position
- `updateLink` — `adminProcedure` mutation for partial updates to an existing link by UUID
- `deleteLink` — `adminProcedure` mutation removing a link; throws `NOT_FOUND` if absent
- `reorderLinks` — `adminProcedure` mutation accepting a batch of `{ id, position }` updates

### Integrations
- `listIntegrations` — `protectedProcedure` query returning all three available services with a `connected` boolean derived from the database
- `connectIntegration` — `adminProcedure` mutation that upserts an integration record; Phase 1 stores a placeholder encrypted token
- `disconnectIntegration` — `adminProcedure` mutation that removes the integration record for a given service

## Tenant Isolation
All queries are scoped to `ctx.tenantId`. `protectedProcedure` reads check `tenantId` at runtime and throw `UNAUTHORIZED` if missing. `adminProcedure` mutations receive `tenantId` as a guaranteed non-null string from the middleware.

## Key Files
- `packages/api/src/routers/hub.ts` — router implementation
- `packages/api/src/routers/hub.test.ts` — unit tests with mocked DB
- `packages/db/src/schema/hub.ts` — Drizzle table definitions (`hubLinks`, `integrations`)
