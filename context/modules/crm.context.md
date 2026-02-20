# CRM Module Context

## Overview

The CRM module provides contact, company, deal, and activity management for Basics OS tenants. It exposes a tRPC router at `packages/api/src/routers/crm.ts` mounted as `crm` on the `appRouter`.

## Structure

The root `crmRouter` composes four sub-routers:

- `contacts` — CRUD for people records, searchable by name/email via ilike
- `companies` — CRUD for organization records, get includes linked contacts
- `deals` — CRUD with a pipeline-grouped list (`listByStage`), stage transitions emit events
- `activities` — create and list deal activities (note, email, call, meeting)

## Tenant Isolation

All queries are scoped to `ctx.tenantId` using Drizzle `eq(table.tenantId, ctx.tenantId)` filters. `protectedProcedure` reads (list/get) check `tenantId` at runtime and throw `UNAUTHORIZED` if missing. `memberProcedure` mutations receive `tenantId` as a guaranteed non-null string from the middleware.

## Event Emission

Mutations emit typed events via `EventBus.emit(createEvent({ ... }))`:

- `crm.contact.created` — after a contact is inserted
- `crm.deal.stage_changed` — whenever a deal stage changes, with `fromStage`/`toStage`
- `crm.deal.won` — additionally emitted when `stage === 'won'`, includes deal `value`
- `crm.deal.lost` — additionally emitted when `stage === 'lost'`
- `crm.activity.logged` — after a deal activity is inserted

## Key Files

- `packages/api/src/routers/crm.ts` — router implementation
- `packages/api/src/routers/crm.test.ts` — unit tests with mocked DB and EventBus
- `packages/db/src/schema/crm.ts` — Drizzle table definitions (contacts, companies, deals, dealActivities)
- `packages/shared/src/validators/crm.ts` — Zod insert schemas
- `packages/shared/src/types/events.ts` — CRM event type definitions
