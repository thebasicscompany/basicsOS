# CRM Sprint Tracker — Source of Truth

> This file is the single source of truth for the 18-sprint CRM feature parity build.
> Update it as you work. After `/clear`, run `/crm-sprint` which will re-read this file.
> **If context compacts mid-sprint, re-read this file first.**

## Current Sprint

**Sprint 1: Soft Deletes + Trash UI** — `pending`

---

## Sprint Status Overview

| # | Name | Status | Migration |
|---|------|--------|-----------|
| 1 | Soft Deletes + Trash UI | `pending` | `0004_soft_deletes.sql` |
| 2 | Custom Pipeline Stages | `pending` | `0005_pipeline_stages.sql` |
| 3 | Saved Views | `pending` | `0006_saved_views.sql` |
| 4 | Audit Trail / Change History | `pending` | `0007_audit_log.sql` |
| 5 | Rich Text Notes (BlockNote) | `pending` | `0008_crm_notes.sql` |
| 6 | CSV Import with Field Mapping | `pending` | _(none)_ |
| 7 | Record-Level Tasks Integration | `pending` | _(none)_ |
| 8 | Favorites / Pinned Records | `pending` | `0009_crm_favorites.sql` |
| 9 | Full-Text Search | `pending` | `0010_crm_search.sql` |
| 10 | Duplicate Detection + Merge | `pending` | `0011_trgm.sql` |
| 11 | Deal Overdue Flagging + Reminders | `pending` | _(none)_ |
| 12 | Bulk Field Update | `pending` | _(none)_ |
| 13 | Contact Enrichment from Email Domain | `pending` | _(none)_ |
| 14 | Custom Field Types / Structured Schema | `pending` | `0012_custom_field_defs.sql` |
| 15 | File Attachments | `pending` | `0013_crm_attachments.sql` |
| 16 | Pipeline Analytics Dashboard | `pending` | _(none)_ |
| 17 | Email Integration — Log Emails | `pending` | _(none)_ |
| 18 | CRM Automation Triggers Wiring | `pending` | _(none)_ |

---

## Sprint 1: Soft Deletes + Trash UI

**Status:** `pending`

**Goal:** All CRM records are soft-deleted (never hard deleted). Trash page to view/restore/purge.

**Checklist:**

- [ ] Write `packages/db/migrations/0004_soft_deletes.sql`
  - `ALTER TABLE contacts ADD COLUMN deleted_at timestamptz`
  - `ALTER TABLE companies ADD COLUMN deleted_at timestamptz`
  - `ALTER TABLE deals ADD COLUMN deleted_at timestamptz`
  - Add partial indexes `WHERE deleted_at IS NULL`
- [ ] Register migration in `packages/db/migrations/meta/_journal.json` (idx: 4)
- [ ] Update `packages/db/src/schema/crm.ts` — add `deletedAt` to contacts, companies, deals tables
- [ ] Update `packages/api/src/routers/crm.ts`:
  - [ ] All `.list` queries: add `.where(isNull(table.deletedAt))`
  - [ ] All `.get` queries: add `.where(isNull(table.deletedAt))`
  - [ ] Change `.delete` procedures to `db.update(...).set({ deletedAt: new Date() })` instead of `db.delete()`
  - [ ] Add `crm.trash.list` — returns contacts/companies/deals deleted in last 30 days
  - [ ] Add `crm.trash.restore` — clears `deletedAt` by id + entity
  - [ ] Add `crm.trash.purge` — permanent hard delete (adminProcedure)
- [ ] Add events to `packages/shared/src/types/events.ts`:
  - `crm.contact.deleted`, `crm.company.deleted`, `crm.deal.deleted`
  - `crm.contact.restored`, `crm.company.restored`, `crm.deal.restored`
- [ ] Emit events in router mutation handlers
- [ ] Create `apps/web/src/app/(dashboard)/crm/trash/page.tsx`
  - Tabs for Contacts / Companies / Deals
  - "Restore" button per row
  - "Purge All" button (admin only)
  - `EmptyState` when trash is empty
- [ ] Add Trash link to CRM sidebar navigation
- [ ] Run `bun --filter @basicsos/db generate`
- [ ] Run `bun --filter @basicsos/api build`
- [ ] Run `bun --filter @basicsos/web build`
- [ ] Run `bun test`
- [ ] Mark Sprint 1 `done` in this file

**Notes / In-Progress State:**
_(Fill in as you work — e.g. "migration written, on API step")_

---

## Sprint 2: Custom Pipeline Stages

**Status:** `pending`

**Goal:** Admins define custom deal stages. Kanban + stage bar use dynamic stages.

**Checklist:**

- [ ] Write `packages/db/migrations/0005_pipeline_stages.sql`
  - Create `pipeline_stages` table (id, tenant_id, name, color, position, is_won, is_lost)
  - Add RLS policy
  - Add `stage_id uuid REFERENCES pipeline_stages(id)` FK to deals
- [ ] Register migration (idx: 5)
- [ ] Update schema: new `pipelineStages` table in `packages/db/src/schema/crm.ts`; add `stageId` to deals
- [ ] API: new `crm.pipelineStages` sub-router (list, create, update, reorder, delete)
- [ ] Seed default 6 stages (lead, qualified, proposal, negotiation, won, lost) on tenant creation
- [ ] Update `apps/web/src/app/(dashboard)/crm/utils.ts` — `STAGES`/`STAGE_COLORS` → hook calling `trpc.crm.pipelineStages.list`
- [ ] Update deals kanban (`deals/page.tsx`) to load stages dynamically
- [ ] Update `StageProgressBar` in `deals/[dealId]/page.tsx` to use dynamic stages
- [ ] Create `apps/web/src/app/(dashboard)/crm/settings/stages/page.tsx` (drag-reorder UI)
- [ ] Build + test
- [ ] Mark Sprint 2 `done`

**Notes:**

---

## Sprint 3: Saved Views

**Status:** `pending`

**Goal:** Named filter+sort+column presets saved per user per entity.

**Checklist:**

- [ ] Write `packages/db/migrations/0006_saved_views.sql` — create `crm_saved_views` table
- [ ] Register migration (idx: 6)
- [ ] Update schema
- [ ] API: `crm.savedViews` sub-router (list, create, update, delete, setDefault)
- [ ] Update `CrmViewBar` — add "Save View" button + saved view switcher dropdown
- [ ] Update `useCrmViewState` hook — load default view on mount, apply filter/sort/columns
- [ ] Build + test
- [ ] Mark Sprint 3 `done`

**Notes:**

---

## Sprint 4: Audit Trail / Change History

**Status:** `pending`

**Goal:** Every field change logged with old/new value, user, timestamp.

**Checklist:**

- [ ] Write `packages/db/migrations/0007_audit_log.sql` — create `crm_audit_log` table
- [ ] Register migration (idx: 7)
- [ ] Update schema
- [ ] API: after each `update` mutation, diff old vs new, bulk-insert to `crm_audit_log`
- [ ] API: add `crm.auditLog.list` (by entity + recordId)
- [ ] Add "History" tab to deal, contact, company detail pages
- [ ] Build + test
- [ ] Mark Sprint 4 `done`

**Notes:**

---

## Sprint 5: Rich Text Notes (BlockNote)

**Status:** `pending`

**Goal:** Rich text notes per CRM record, stored as ProseMirror JSON.

**Checklist:**

- [ ] Write `packages/db/migrations/0008_crm_notes.sql` — create `crm_notes` table
- [ ] Register migration (idx: 8)
- [ ] Update schema
- [ ] API: `crm.notes.get`, `crm.notes.upsert`
- [ ] Create `CrmNotesPanel` component (reference BlockNote usage in knowledge base module)
- [ ] Add panel to all three detail pages
- [ ] Build + test
- [ ] Mark Sprint 5 `done`

**Notes:**

---

## Sprint 6: CSV Import with Field Mapping

**Status:** `pending`

**Goal:** Upload CSV → map columns → preview → bulk import for contacts and companies.

**Checklist:**

- [ ] Verify `papaparse` in deps (or add to `apps/web/package.json`)
- [ ] Create `apps/web/src/app/(dashboard)/crm/import/page.tsx` (4-step wizard)
- [ ] Create `apps/web/src/app/(dashboard)/crm/utils/csvImport.ts` (parsing utility)
- [ ] API: `crm.contacts.import`, `crm.companies.import` (array of row objects)
- [ ] Build + test
- [ ] Mark Sprint 6 `done`

**Notes:**

---

## Sprint 7: Record-Level Tasks Integration

**Status:** `pending`

**Goal:** Tasks linked to CRM records, shown in detail pages.

**Checklist:**

- [ ] Verify `tasks` schema has `relatedEntityType` + `relatedEntityId` columns
- [ ] API: `tasks.listByEntity` procedure
- [ ] Create `CrmTasksPanel` component
- [ ] Add to deals, contacts, companies detail pages
- [ ] Build + test
- [ ] Mark Sprint 7 `done`

**Notes:**

---

## Sprint 8: Favorites / Pinned Records

**Status:** `pending`

**Goal:** Star contacts/companies/deals; Favorites section in sidebar.

**Checklist:**

- [ ] Write `packages/db/migrations/0009_crm_favorites.sql`
- [ ] Register migration (idx: 9)
- [ ] Update schema
- [ ] API: `crm.favorites.list`, `crm.favorites.toggle`
- [ ] Add star icon to all detail page headers
- [ ] Add "Favorites" section in CRM sidebar nav
- [ ] Build + test
- [ ] Mark Sprint 8 `done`

**Notes:**

---

## Sprint 9: Full-Text Search

**Status:** `pending`

**Goal:** Global CRM search across contacts/companies/deals using PostgreSQL GIN + tsvector.

**Checklist:**

- [ ] Write `packages/db/migrations/0010_crm_search.sql` — add `search_vector` generated columns + GIN indexes
- [ ] Register migration (idx: 10)
- [ ] Update schema
- [ ] API: `crm.search` (query string → union of contacts/companies/deals results)
- [ ] Update list page search bars to use `crm.search`, show unified dropdown
- [ ] Build + test
- [ ] Mark Sprint 9 `done`

**Notes:**

---

## Sprint 10: Duplicate Detection + Merge

**Status:** `pending`

**Goal:** Find duplicate contacts/companies via pg_trgm; merge UI.

**Checklist:**

- [ ] Write `packages/db/migrations/0011_trgm.sql` — `CREATE EXTENSION IF NOT EXISTS pg_trgm` + trgm indexes
- [ ] Register migration (idx: 11)
- [ ] API: `crm.contacts.findDuplicates`, `crm.contacts.merge`, same for companies
- [ ] Create `MergeDuplicatesDialog` component (side-by-side field comparison)
- [ ] Add "Duplicates" badge/link to list pages
- [ ] Build + test
- [ ] Mark Sprint 10 `done`

**Notes:**

---

## Sprint 11: Deal Overdue Flagging + Reminders

**Status:** `pending`

**Goal:** Flag overdue deals; BullMQ reminders.

**Checklist:**

- [ ] API: `crm.deals.listOverdue` — deals past closeDate, not won/lost
- [ ] API: `crm.reminders.create` — schedules BullMQ job
- [ ] Create `crm-reminder.worker.ts` BullMQ worker (in-app notification)
- [ ] Add "Overdue" badge to deal cards/rows
- [ ] Add "Set Reminder" button to deal detail page
- [ ] Add "Overdue" filter preset to deals view bar
- [ ] Build + test
- [ ] Mark Sprint 11 `done`

**Notes:**

---

## Sprint 12: Bulk Field Update

**Status:** `pending`

**Goal:** Select multiple records → update one field across all.

**Checklist:**

- [ ] API: `crm.contacts.bulkUpdate`, `crm.companies.bulkUpdate`, `crm.deals.bulkUpdate`
- [ ] Create `BulkEditDialog` component (field selector + value input)
- [ ] Extend bulk action bar in `CrmRecordTable` with "Edit Field" option
- [ ] Build + test
- [ ] Mark Sprint 12 `done`

**Notes:**

---

## Sprint 13: Contact Enrichment from Email Domain

**Status:** `pending`

**Goal:** Auto-suggest company linkage when email domain matches a known company.

**Checklist:**

- [ ] API: `crm.contacts.enrichFromDomain` — find company by domain
- [ ] API: `crm.contacts.linkToCompany` — set `companyId`
- [ ] Add suggestion banner to contact detail page (when unlinked + domain match found)
- [ ] Build + test
- [ ] Mark Sprint 13 `done`

**Notes:**

---

## Sprint 14: Custom Field Types / Structured Schema

**Status:** `pending`

**Goal:** Replace free-form JSONB custom fields with typed schema (text, number, date, boolean, select, multi-select, URL, phone).

**Checklist:**

- [ ] Write `packages/db/migrations/0012_custom_field_defs.sql` — create `custom_field_defs` table
- [ ] Register migration (idx: 12)
- [ ] Update schema
- [ ] API: `crm.customFieldDefs` sub-router (list, create, update, delete)
- [ ] Validate custom field values against defs in create/update mutations
- [ ] Create `apps/web/src/app/(dashboard)/crm/settings/fields/page.tsx`
- [ ] Update `CustomFieldsEditor` to render type-appropriate inputs
- [ ] Update `useCustomFieldColumns` to render values per type
- [ ] Build + test
- [ ] Mark Sprint 14 `done`

**Notes:**

---

## Sprint 15: File Attachments

**Status:** `pending`

**Goal:** Attach files to CRM records via S3-compatible presigned upload.

**Checklist:**

- [ ] Write `packages/db/migrations/0013_crm_attachments.sql` — create `crm_attachments` table
- [ ] Register migration (idx: 13)
- [ ] Update schema
- [ ] API: `crm.attachments.list`, `crm.attachments.getUploadUrl`, `crm.attachments.confirmUpload`, `crm.attachments.delete`
- [ ] Create `CrmAttachmentsPanel` component (dropzone + file list)
- [ ] Add to all three detail pages
- [ ] Build + test
- [ ] Mark Sprint 15 `done`

**Notes:**

---

## Sprint 16: Pipeline Analytics Dashboard

**Status:** `pending`

**Goal:** CRM analytics: pipeline value, win rate, avg deal size, funnel chart, revenue over time.

**Checklist:**

- [ ] API: `crm.analytics.pipeline` — stage breakdown, win/loss rate, value by month
- [ ] Create `apps/web/src/app/(dashboard)/crm/analytics/page.tsx`
  - Summary stat cards
  - Stage funnel chart (Recharts)
  - Revenue over time line chart
  - Top companies/contacts table
- [ ] Build + test
- [ ] Mark Sprint 16 `done`

**Notes:**

---

## Sprint 17: Email Integration — Log Emails to Deal Timeline

**Status:** `pending`

**Goal:** Manually log emails to deal activity timeline; email activity type.

**Checklist:**

- [ ] Add `email` to activity type enum in schema
- [ ] API: `crm.activities.logEmail` — creates email activity
- [ ] Add "Log Email" button in `DealActivitiesPanel`
- [ ] Email activity renders with Mail icon in timeline
- [ ] Build + test
- [ ] Mark Sprint 17 `done`

**Notes:**

---

## Sprint 18: CRM Automation Triggers Wiring

**Status:** `pending`

**Goal:** Wire CRM events to automation engine; add CRM triggers to automation builder.

**Checklist:**

- [ ] Subscribe to `crm.deal.stage_changed`, `crm.deal.won`, `crm.deal.lost`, `crm.contact.created`, `crm.company.created` in automation worker
- [ ] Evaluate matching automation rules on each event
- [ ] Add CRM trigger options to automation builder UI ("Deal stage changes", "Deal created", "Contact created")
- [ ] Build + test
- [ ] Mark Sprint 18 `done` — **CRM parity complete!**

**Notes:**

---

## Architecture Notes (Add as You Go)

_Record any important architectural decisions, gotchas, or patterns discovered during implementation._

- Last migration idx at plan creation: **3** (0003_deals_custom_fields.sql)
- Branch: `UI-updates`
- Twenty reference repo: `/Users/akeilsmith/twenty` (shallow clone)
