# TODO — crm-ui Branch Audit

Deep-dive audit of the NocoDB refactor. Issues ordered by severity.

---

## 🔴 Critical (Blockers)

### 1. `BETTER_AUTH_SECRET` is a placeholder in both `.env` files
- `packages/server/.env` and `.env` both contain the literal string `generate-with-openssl-rand-base64-32`
- This is not a secret — it's the placeholder from `.env.example`
- Auth tokens are signed with this value; anyone who knows the placeholder can forge sessions
- **Fix:** Run `openssl rand -base64 32` and set real values in both files

### 2. `NOCODB_API_TOKEN` and `NOCODB_BASE_ID` not set
- `packages/server/.env` has no `NOCODB_API_TOKEN` or `NOCODB_BASE_ID`
- The Zod schema defaults both to empty strings, so the server starts without error
- But every call to `GET /api/nocodb-config` returns HTTP 503 ("NocoDB not configured")
- The entire NocoDB-backed object registry, all list pages, and all detail pages fail silently at the provider level
- **Fix:** After `make docker-up`, open NocoDB at http://localhost:8080, generate an API token and grab the base ID, then add them to `packages/server/.env`

### 3. `FilterPopover.tsx` — `.value` vs `.key` bug (filters always default to "eq")
- `src/components/data-table/FilterPopover.tsx` lines **54** and **121** access `filterOperators[0]?.value`
- The `FilterOperator` interface (`src/field-types/types.ts:90`) defines the property as **`key`**, not `value`
- Result: `filterOperators[0]?.value` is always `undefined`, so the fallback `"eq"` is always used regardless of field type
- Changing field type in the filter popover never updates the operator — all filters silently use "eq"
- **Fix:** Change `.value` → `.key` at lines 54 and 121 in `FilterPopover.tsx`

### 4. Drizzle migration journal is out of sync with migration files
- `packages/server/drizzle/meta/_journal.json` only has 3 entries: `0000`, `0001`, `0002`
- But migration files `0003_nocodb_views.sql` and `0005_object_config.sql` exist on disk and are never registered
- Running `make db-migrate` or `pnpm db:migrate` will NOT apply the views or the `object_config` table
- The entire object registry (`object_config`, `object_attribute_overrides`, `record_favorites`) and the `contacts_summary`/`companies_summary` views will be missing from the database
- **Fix:** Add `0003` and `0005` entries to `_journal.json`, or re-generate with `drizzle-kit generate` to create a proper sequential migration. Verify with `drizzle-kit status`.

### 5. `AirtableImportPage` exists but is not routed
- `src/components/pages/AirtableImportPage.tsx` is a complete component with `AirtableImportPage.path = "/airtable-import"`
- It is **never imported or registered** in `src/App.tsx`
- The page is completely unreachable
- **Fix:** Add `<Route path="/airtable-import" element={<AirtableImportPage />} />` to `App.tsx`, or delete the file if it's not ready

---

## 🟠 High

### 6. `NC_AUTH_JWT_SECRET` defaults to `change-me-in-production` in `docker-compose.yml`
- `docker-compose.yml` line 27: `NC_AUTH_JWT_SECRET: "${NC_AUTH_JWT_SECRET:-change-me-in-production}"`
- If `NC_AUTH_JWT_SECRET` is not set in the root `.env`, NocoDB uses this hardcoded fallback
- The root `.env` only has `BETTER_AUTH_SECRET` — `NC_AUTH_JWT_SECRET` is absent
- **Fix:** Add `NC_AUTH_JWT_SECRET=<random>` to the root `.env`

### 7. View save doesn't handle updating existing filters (only create/delete)
- `src/hooks/use-views.ts` `save()` function (lines 384–405) handles two cases for filters: create new ones (temp IDs) and delete removed ones
- **Missing case:** if an existing filter's `operator` or `value` is changed, it is never persisted — the filter keeps its old server-side values
- The UI looks like it saved, but the change is lost on next reload
- **Fix:** Add an update path: for existing filters (non-temp IDs) that appear in both server and local state with changed fields, call a PATCH/update on the NocoDB filter endpoint

### 8. `sales_id` scoping applied to tables that may not have that column
- `src/lib/api/crm-nocodb.ts` — `SALES_SCOPED` set includes `companies`, `deals`, `tasks`, `contact_notes`, `deal_notes`, `automation_rules`, `companies_summary`, `contacts_summary`
- `buildWhereClause` in `src/lib/nocodb/filters.ts` injects `(sales_id,eq,<id>)` for all these resources
- If any of these tables don't have a `sales_id` column (or NocoDB doesn't expose it by that exact column name), the filter will silently return 0 results or throw an error
- **Fix:** Verify each table in the `SALES_SCOPED` set has a `sales_id` column accessible via NocoDB. Check `contacts` — it likely has `sales_id` but `companies` and `tags` may not.

### 9. RecordDetailPage — Activity, Notes, and Tasks tabs are empty placeholders
- `src/components/pages/RecordDetailPage.tsx` tabs for "activity", "notes", and "tasks" render `<div>No activity yet.</div>` etc.
- These are shown prominently in the UI as if they work
- **Fix:** Either implement these tabs (wire up `contact_notes`, `deal_notes`, `tasks` queries) or hide the tabs until implemented

### 10. Frontend has full NocoDB meta API access via the data token
- The token returned by `/api/nocodb-config` is used for both data (`/api/v2/tables/*/records`) and meta operations (`/api/v2/meta/tables/*/views`, sorts, filters, columns)
- This means any authenticated browser session can create/delete NocoDB views, modify column schemas, etc.
- The token scope is not restricted to read-only or data-only
- **Fix:** If NocoDB supports scoped tokens or read-only tokens, consider using separate tokens for data vs. meta. At minimum, document this as an accepted risk.

---

## 🟡 Medium

### 11. Missing migration `0004` — gap in numbering
- Migration files jump from `0003_nocodb_views.sql` to `0005_object_config.sql` with no `0004`
- This suggests a migration was deleted or skipped
- The journal also only has entries for `0000`–`0002`, so it's unclear what state the DB is actually in
- **Fix:** Audit what `0004` was supposed to contain. If it was merged into another migration, document it. Run `drizzle-kit status` to reconcile.

### 12. `contacts_summary` and `companies_summary` views may not be auto-discovered by NocoDB
- Migration `0003_nocodb_views.sql` creates `contacts_summary` and `companies_summary` as PostgreSQL views
- NocoDB introspects the database and picks up views — but only if they're in the same schema and the NocoDB base connection has access
- The `crm-nocodb.ts` `SALES_SCOPED` set includes `companies_summary` and `contacts_summary`, assuming NocoDB exposes them as queryable tables
- If NocoDB doesn't pick them up, any page using these resources will throw "No NocoDB table ID for resource" at runtime
- **Fix:** After `make docker-up` and connecting NocoDB to the DB, confirm both views appear in the NocoDB table list. If not, they may need to be explicitly imported or replaced with regular tables.

### 13. `setNocoSalesId` is module-level mutable state
- `src/lib/api/crm-nocodb.ts` stores `_salesId` as a module-level `let` variable set via `setNocoSalesId()`
- `NocoDBProvider` calls this during initialization, so the value is correct for a single logged-in user
- However, if the salesId ever changes (e.g., user switches accounts, or future multi-tab support), this won't update until a page reload
- **Fix:** Low priority for now, but consider storing `salesId` in React context and passing it through the query chain rather than as a module-level global

### 14. `ObjectListPage` passes `objectSlug` as the NocoDB resource name, but table map uses different keys
- `useRecords(objectSlug)` → `crmApi.getList(objectSlug)` → `getTableId(objectSlug)`
- `getTableId` looks up the slug (e.g., `"contacts"`) in the table map returned by `/api/nocodb-config`
- The table map is built from NocoDB's actual table names (via `object_config.noco_table_name`)
- If the slug and NocoDB table name differ (e.g., slug is `"people"` but NocoDB table is `"contacts"`), lookups fail
- **Fix:** The `ObjectRegistryProvider` should resolve the correct table ID and pass it through, rather than relying on slug = table map key. Or ensure the table map is always keyed by slug, not by NocoDB table name.

### 15. View filter save uses `fk_column_id: filter.fieldId` but `fieldId` is an attribute ID (NocoDB column ID)
- In `use-views.ts` save(), new filters are created with `fk_column_id: filter.fieldId`
- `filter.fieldId` is set from `ViewFilter.fieldId` which comes from `Attribute.id` (the NocoDB column ID, e.g. `"col_abc123"`)
- This should be correct if `Attribute.id` matches NocoDB's `fk_column_id` — but verify this is actually the case, not a `column_name` string
- **Fix:** Add a comment confirming `Attribute.id === NocoDB column ID`, or trace through the ObjectRegistryProvider to confirm the `id` field is set to NocoDB's column ID

---

## 🟢 Low / Polish

### 16. Hardcoded `slugToType` mapping in `RecordDetailPage`
- `src/components/pages/RecordDetailPage.tsx` has a hardcoded `{ contacts: "contact", companies: "company", deals: "deal" }` map
- Used only for `useRecentItems` tracking — if new object types are added to the registry, they won't be tracked
- **Fix:** Either derive the type from the `ObjectConfig` (e.g., use `singularName.toLowerCase()`), or make `useRecentItems` accept a generic string type

### 17. `ViewSaveBar` says "Save for everyone" but this is a single-user app
- The copy "Save for everyone" implies shared views, but this is a personal CRM
- **Fix:** Change copy to "Save view" or "Save changes"

### 18. `docker-compose.yml` — NocoDB `NC_DB` uses internal `postgres:5432` hostname
- This is correct for Docker internal networking, but is not obvious
- The external port is `5435` (mapped from `5432`), but NocoDB uses the internal service name `postgres` on `5432`
- Not a bug, but could confuse developers trying to debug connectivity
- **Fix:** Add a comment in `docker-compose.yml` explaining the internal vs external port distinction

### 19. No loading state shown in `ObjectListPage` while `NocoDBProvider` or `ObjectRegistryProvider` are initializing
- Both providers show a full-screen loader at the app level while booting
- But `ObjectListPage` itself renders before views/records are fully loaded, showing a flash of empty table
- **Fix:** Add skeleton loading rows to `DataTable` when `isLoading` is true (TanStack Table supports this pattern)

### 20. `SpreadsheetGrid` sort state can drift from `DataTableToolbar` sort state
- `SpreadsheetGrid` manages its own `toolbarSorting` state separately from TanStack Table's internal sort state
- When a column header is clicked, TanStack updates its internal sort, but `toolbarSorting` is only updated via `setToolbarSorting([{ id: header.column.id, desc: false }])`
- If the user sorts via toolbar AND then via column header, the two states diverge
- **Fix:** Derive toolbar sort state from TanStack's `table.getState().sorting` rather than maintaining separate state

---

## Setup Checklist (Before First Run)

```bash
# 1. Generate real secrets
openssl rand -base64 32  # → BETTER_AUTH_SECRET in packages/server/.env and .env
openssl rand -base64 32  # → NC_AUTH_JWT_SECRET in .env

# 2. Start Docker services
make docker-up

# 3. Open NocoDB at http://localhost:8080
#    - Create an account
#    - Connect to DB: postgres://postgres:postgres@postgres:5432/crm
#    - Get the Base ID from the URL
#    - Generate an API token from Team & Auth → API Tokens

# 4. Add to packages/server/.env:
#    NOCODB_API_TOKEN=<token from step 3>
#    NOCODB_BASE_ID=<base id from step 3>
#    NOCODB_BASE_URL=http://localhost:8080

# 5. Fix migration journal — apply missing migrations manually:
#    psql postgresql://postgres:postgres@localhost:5435/crm < packages/server/drizzle/0003_nocodb_views.sql
#    psql postgresql://postgres:postgres@localhost:5435/crm < packages/server/drizzle/0005_object_config.sql

# 6. Start the dev server
make start-rest
```
