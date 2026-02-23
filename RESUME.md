# CRM Table Views — Engineering Handoff

**Branch:** `UI-updates`
**Repo:** https://github.com/thebasicscompany/basicsOS
**Last commit:** `aa3d4952` — feat: CRM table views

## What was done

Five phases of CRM table view improvements were implemented on the `UI-updates` branch, building on top of the existing CRM module.

### Phase 9: Column Visibility Toggle
- Added `DropdownMenuCheckboxItem` to `@basicsos/ui` ([DropdownMenu.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/packages/ui/src/components/DropdownMenu.tsx))
- Added `hiddenColumns` + `toggleColumn` to the view state hook, persisted in URL as `?hidden=col1,col2` ([useCrmViewState.ts](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/hooks/useCrmViewState.ts))
- "Fields" dropdown added to the toolbar ([CrmViewBar.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/components/CrmViewBar.tsx))
- Table filters columns before rendering ([CrmRecordTable.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/components/CrmRecordTable.tsx))

### Phase 10: Custom Fields in Table Views
- Created `useCustomFieldColumns` hook — scans all records' JSONB `customFields`, generates `ColumnDef` entries with `cf_` prefix ([useCustomFieldColumns.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/hooks/useCustomFieldColumns.tsx))
- Wired into contacts and companies pages — custom fields auto-appear as sortable table columns
- Added `CustomFieldsEditor` to `EditCompanyDialog` (was missing) ([EditCompanyDialog.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/EditCompanyDialog.tsx))

### Phase 11: Keyboard Navigation + Context Menu
- Arrow keys / j/k navigate rows, Enter opens detail, Space toggles checkbox, Escape clears focus
- `/` key focuses the search input (skips if already in a form field)
- Right-click context menu on all entity tables with view/copy/delete actions
- All in [CrmRecordTable.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/components/CrmRecordTable.tsx) and [CrmViewBar.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/components/CrmViewBar.tsx)

### Phase 12: Bulk Stage Change + CSV Export
- `exportCsv` utility added to [utils.ts](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/utils.ts)
- "Export CSV" button in the bulk action bar on all 3 entity pages
- "Move to [stage]" bulk dropdown on the deals page
- Wired into: [contacts/page.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/contacts/page.tsx), [companies/page.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/companies/page.tsx), [deals/page.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/deals/page.tsx)

### Bug Fix
- Fixed `SelectItem value=""` crash in [CreateContactDialog.tsx](https://github.com/thebasicscompany/basicsOS/blob/UI-updates/apps/web/src/app/(dashboard)/crm/CreateContactDialog.tsx) — Radix Select doesn't allow empty string values. Changed to `"none"` with handler to map it back to `undefined`.

## Files changed (key ones)

| File | What changed |
|------|-------------|
| `packages/ui/src/components/DropdownMenu.tsx` | Added `DropdownMenuCheckboxItem` |
| `packages/ui/src/index.ts` | Exported `DropdownMenuCheckboxItem`, `Columns3` icon |
| `crm/hooks/useCrmViewState.ts` | Added `hiddenColumns`, `toggleColumn` |
| `crm/hooks/useCustomFieldColumns.tsx` | New — generates columns from JSONB custom fields |
| `crm/components/CrmRecordTable.tsx` | Column filtering, keyboard nav, context menu |
| `crm/components/CrmViewBar.tsx` | Fields dropdown, `/` search shortcut |
| `crm/components/CrmBulkActionBar.tsx` | Already had `extraActions` slot (no changes needed) |
| `crm/utils.ts` | Added `exportCsv` utility |
| `crm/contacts/page.tsx` | Wired up all new features |
| `crm/companies/page.tsx` | Wired up all new features |
| `crm/deals/page.tsx` | Wired up all new features + bulk stage change |
| `crm/EditCompanyDialog.tsx` | Added `CustomFieldsEditor` |
| `crm/CreateContactDialog.tsx` | Fixed empty SelectItem value |

## What's left / known issues

1. **No remaining phases from the original plan** — Phases 9-12 are complete.
2. **Pre-existing type errors** in `apps/web/src/app/(dashboard)/page.tsx` (duplicate `ComponentType` identifier) and `tasks/page.tsx` (missing `Card` import) — not related to CRM work.
3. **Custom fields on deals** — The deals table in the DB doesn't have a `customFields` column yet. Only contacts and companies have it.
4. **Custom field editing inline** — Custom field columns in the table are read-only. Editing is done through the Edit dialogs.

## How to continue

```bash
git clone https://github.com/thebasicscompany/basicsOS.git
cd basicsOS
git checkout UI-updates
bun install
bun --filter @basicsos/ui build    # build UI package first
bun --filter @basicsos/api dev     # API on :3001
bun --filter @basicsos/web dev     # Web on :3000
```

Make sure Docker is running for Postgres (`DATABASE_URL=postgresql://basicos:basicos_dev@localhost:5432/basicos`).

## Architecture notes

- All CRM view state (search, sort, filters, hidden columns, view type) lives in **URL search params** via `useCrmViewState`. No React state or localStorage — fully shareable links.
- Custom field columns use a `cf_` prefix to distinguish from standard columns in sort/filter value functions.
- The `CrmRecordTable` is generic (`<T>`) — it works with any record type. Entity pages define their own `ColumnDef<T>[]` arrays.
- The bulk action bar uses an `extraActions` slot for per-entity buttons (stage change on deals, export on all).
- Context menu is rendered as a fixed-position div, dismissed on click/scroll/escape. Not using Radix context menu to keep it lightweight.
