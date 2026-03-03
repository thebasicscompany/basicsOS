# Implementation Plan

## A — Automations Pages: Style Refactor

### Problem
Both automations pages manage their own header chrome instead of using the shared layout system.

- **`AutomationListPage`** renders an inline `<div>` with `<h1>`, `<p>`, and a "New Automation" button — bypassing `usePageTitle` / `usePageHeaderActions`.
- **`AutomationBuilderPage`** uses `-mx-4 -mt-4 flex flex-col overflow-hidden` with `style={{ height: "100dvh" }}` to escape the layout entirely and renders its own 14px top bar.

---

### A1 — `AutomationListPage`

**Changes:**
1. Remove the inline header block (`<div className="flex items-start justify-between">`). That's the h1, subtitle p, and New Automation button.
2. Call `usePageTitle("Automations")` at the top of the component.
3. Build the "New Automation" button as a `ReactNode` and pass it to `usePageHeaderActions(...)`. Render the returned portal in the JSX (same pattern as `ObjectListPage`).
4. Change the root `<div className="space-y-6">` to `<div className="flex min-h-0 flex-1 flex-col gap-4 pt-4">` so it matches the layout padding/flex of other pages.
5. Move `AutomationRunsPanel` to the root so it renders outside the scroll container.

**Result:** Automations list looks like any other page — title in the sticky header, New button in the header actions slot, content in the scrollable body.

---

### A2 — `AutomationBuilderPage`

The builder is a full-screen canvas editor. The goal is not to force it into the standard content box, but to integrate it cleanly with the layout header instead of owning a second shadow header.

**Changes:**
1. **Remove the custom top bar div** (`flex h-14 shrink-0 items-center gap-3 border-b`).
2. **Remove the escape hatch**: drop `-mx-4 -mt-4` and `style={{ height: "100dvh" }}`. The layout's `SidebarInset` is already `flex h-svh flex-col`. The `LayoutContent` child is `flex flex-1 min-h-0 flex-col`. So `BuilderInner` just needs `className="flex min-h-0 flex-1 flex-col"` and it fills the remaining space naturally.
3. Call `usePageTitle(name || "New Automation")` so the layout header shows the breadcrumb.
4. Build the header actions node containing:
   - Back button (`ChevronLeft`, navigates to `/automations`) — leftmost in the header, before the title. Since the header only supports a right-side actions slot, keep Back as the first item in the actions dropdown **or** use a `<Separator>` to visually prefix it, matching the `SidebarTrigger | Separator | title` pattern already in `LayoutHeader`. Best option: place Back button in the actions portal but with `mr-auto` so it floats left within the flex container.
   - Inline name `<Input>` (borderless, like existing) between back and the right-side buttons.
   - Add node dropdown.
   - History button (existing automations only).
   - Save button.
5. The canvas + properties panel fill `flex-1 min-h-0`.

**Note:** The `@xyflow/react` stylesheet import (`@xyflow/react/dist/style.css`) should be audited — it may inject global styles that conflict with the app theme.

---

## B — Automations Builder & Log History Improvements

### B1 — `AutomationRunsPanel` (Log History)

**Current:** A Sheet with a flat list of runs, each showing status badge, timestamp, duration, and a raw JSON `<pre>` block.

**Improvements:**

1. **Status icons:** Replace text badges with icon+label pairs — `CheckCircle2` (green) for success, `XCircle` (red) for error, `Loader2 animate-spin` for running.

2. **Relative timestamps:** Show `"3 minutes ago"` using `Intl.RelativeTimeFormat` or a simple helper. Show the full datetime on hover via `title` attribute.

3. **Better JSON rendering:** Wrap the `<pre>` block in a `<details>` / `<summary>` element so it collapses by default. Add a copy-to-clipboard button. Syntax-color keys vs values with a simple CSS class split (no library needed — stringify with 2-space indent is already present).

4. **Filter tabs:** Add `All | Success | Error` tabs above the list using the `Tabs` component. Filter client-side from the fetched 20 runs.

5. **Step-level logs _(requires backend)_:** If the automation runner stores per-node results in a `steps` array on the run record, render a timeline: each node icon → status → output. Otherwise, skip until backend supports it.

6. **Load more:** Add a "Load more" button that increments the `limit` query param from 20 → 40 → 60.

---

### B2 — Builder Canvas

1. **Enabled/disabled toggle in header:** Add a `Switch` (labeled "Active") next to the Save button. On toggle, immediately `PATCH` the rule's `enabled` field without navigating away. Only shown for existing automations.

2. **Trigger validation:** Before saving, check that `nodes.some(n => n.type.startsWith("trigger_"))`. If no trigger node exists, show a `toast.error("Add a trigger node before saving")` and abort.

3. **Test run button:** A "Run now" button (only for saved automations) that POSTs to `/api/automation-rules/:id/run`. Show a loading state and then open the runs panel to see the result.

4. **Dirty indicator:** Track whether nodes/edges have changed since load. Show an unsaved indicator (`●  Unsaved changes`) next to the name input. Clear it on successful save.

5. **Canvas controls:** `WorkflowControls` already exists — ensure it includes a "fit view" button. Add a `Background` pattern from `@xyflow/react` (dots or lines) if not already present.

6. **Minimap:** Add `<MiniMap />` from `@xyflow/react` inside the canvas area. Position bottom-right. Toggle visibility with a button in `WorkflowControls`.

---

## C — Fix: New Views Don't Activate After Creation

### Background: what the "Noco" hooks actually call

Despite the `useNocoViews` naming, these hooks call **your own `/api/views/...` backend**, not NocoDB directly. The data lives entirely in `basics-postgres-1` (`crm` database) across four tables: `views`, `view_columns`, `view_sorts`, `view_filters`. The field naming convention (`fk_column_id`, `is_default`, numeric `type`) mirrors NocoDB's API shape, but the implementation is your own. NocoDB is running as a separate container and is not involved in this flow.

### Root cause

In `use-views.ts`, the `createViewMutation.onSuccess` only calls `qc.invalidateQueries`. It does **not** call `setActiveView`. The new view appears in the tab list but the URL `?view=` param is never updated, so the old (default) view remains active and no data loads from the new view.

Additionally, when a new grid view is created, the backend inserts a row into `views` but inserts **no rows** into `view_columns` — so the new view has zero visible columns until they are explicitly configured.

---

### Fixes

**C1 — Auto-select new view after creation**

In `ObjectListPage.tsx`, change the `createView.mutate(...)` call to `createView.mutateAsync(...)` and chain `.then(newView => setActiveView(newView.id))`:

```tsx
// Before
createView.mutate({ title: `View ${views.length + 1}` })

// After
createView.mutateAsync({ title: `View ${views.length + 1}` })
  .then((newView) => setActiveView(newView.id))
  .catch(() => {}) // mutation already shows toast on error
```

This works because `useMutation.mutateAsync` returns a Promise resolving to the mutation result (`ViewConfig`), which includes the new view's `id`.

**C2 — Seed new view columns from the default view**

After activating the new view, check if `viewState.columns` is empty. If so, copy column visibility/order from the default view's columns (available from the already-fetched `views` + `attributes` list) and call `viewState.updateColumn` for each, then immediately `viewState.save()`. This is a client-side bootstrap — no extra API needed since the columns endpoint always returns the full attribute list; it's just a matter of setting `show: true` and assigning `order` values.

Alternatively, do this in a `useEffect` in `ObjectListPage` that watches `[activeView?.id, viewState.columns.length]`: if columns are empty for a non-default view, seed from attributes.

**C3 — View rename**

Add double-click-to-rename on view tabs in `ViewSelector`:
- On double-click, replace the tab label with a small `<Input>` (same width).
- On blur or Enter, call a new `useRenameView(viewId)` mutation.
- On Escape, cancel.

**C4 — View delete**

Add a `×` button on non-default view tabs (visible on hover). Call a new `useDeleteView()` mutation. On success, invalidate views and switch to the default view.

New frontend hooks needed (add to `use-noco-views.ts`):
```ts
useRenameView(viewId: string) → PATCH /api/views/view/:viewId  body: { title }
useDeleteView()               → DELETE /api/views/view/:viewId
```

New backend routes needed (these don't exist yet):
```
PATCH  /api/views/view/:viewId   → UPDATE views SET title = $1 WHERE id = $2
DELETE /api/views/view/:viewId   → DELETE FROM views WHERE id = $1 (cascades to view_columns/sorts/filters via FK)
```

---

## D — Fix: Horizontal Scroll Bleeds Into Sticky Columns

### Root cause

The `_select` (checkbox) and `_rowNum` (#) columns are `position: sticky` with no opaque background on **header** cells. `SortableHeaderCell` and the plain `TableHead` render inside `<TableHeader>` which has `bg-muted/40` — but this is a semi-transparent color. When body content scrolls under these headers, it bleeds through.

Body cells correctly apply `bg-background` when sticky (line 819 of `DataTable.tsx`), but headers do not.

The user also notes that both columns are unneeded. **Removing them entirely is the cleanest fix.**

---

### Fix: Remove `_select` and `_rowNum` columns

In `DataTable.tsx`:

1. **Delete the `_select` column definition** (the checkbox column, ~lines 289–317 of the `columns` useMemo).

2. **Delete the `_rowNum` column definition** (the row number / expand column, ~lines 319–345).

3. **Remove row selection state**: delete `rowSelection`, `setRowSelection`, and the `onRowSelectionChange`/`enableRowSelection`/`state.rowSelection` fields from `useReactTable`.

4. **Remove the bulk actions bar** (the `selectedRowIds.length > 0 && onRowDelete &&` block, ~lines 603–616). Since checkboxes are gone, bulk delete via selection is gone. Row delete should be surfaced via a right-click context menu or an action in the expand/detail view.

5. **Remove `onRowDelete` from `DataTableProps`** and from `ObjectListPage.tsx`'s `handleRowDelete` + prop pass.

6. **Remove `_select` / `_rowNum` from the sticky logic** in both the header and body render loops. The sticky detection checks `header.id === "_select" || header.id === "_rowNum"` — remove those branches.

7. **Adjust the primary attribute sticky offset**: was `left: 88` (40px checkbox + 48px rownum). After removal it becomes `left: 0`.

8. **Fix header background for the remaining sticky primary column**: In the header render loop, when `isPrimaryAttr` is true, add `bg-background` to the `SortableHeaderCell` via its `className` prop (the component already accepts `className` via `...rest`). This ensures the sticky first-column header is opaque when content scrolls under it.

### Summary of changes

| File | Change |
|---|---|
| `DataTable.tsx` | Remove `_select` + `_rowNum` column defs, row selection state, bulk bar, sticky logic for those cols, fix primary col sticky offset from 88→0, add `bg-background` to primary col header |
| `ObjectListPage.tsx` | Remove `handleRowDelete`, remove `onRowDelete` prop from `<DataTable>` |

---

## E — Remove NocoDB Naming

The codebase uses "noco"/"NocoDB" naming throughout hooks, files, interfaces, query keys, and a utility directory even though NocoDB is not involved in these code paths. This should be cleaned up for clarity.

---

### E1 — Files to rename

| Old path | New path |
|---|---|
| `src/hooks/use-noco-views.ts` | `src/hooks/use-view-queries.ts` |
| `src/hooks/use-nocodb-columns.ts` | `src/hooks/use-columns.ts` |
| `src/lib/api/crm-nocodb.ts` | merge into `src/lib/api/crm.ts` (currently `crm.ts` is just a re-export barrel — collapse them into one file) |
| `src/lib/nocodb/filters.ts` | `src/lib/crm/filters.ts` |
| `src/lib/nocodb/field-mapper.ts` | `src/lib/crm/field-mapper.ts` |
| `src/field-types/nocodb-map.ts` | `src/field-types/field-type-map.ts` |

---

### E2 — Hook and interface renames

**In `use-view-queries.ts` (was `use-noco-views.ts`):**

| Old | New |
|---|---|
| `NocoViewRaw` | `ViewRaw` |
| `NocoViewColumnRaw` | `ViewColumnRaw` |
| `NocoViewSortRaw` | `ViewSortRaw` |
| `NocoViewFilterRaw` | `ViewFilterRaw` |
| `useNocoViews` | `useViewList` |
| `useNocoViewColumns` | `useViewColumns` |
| `useUpdateNocoViewColumn` | `useUpdateViewColumn` |
| `useNocoViewSorts` | `useViewSorts` |
| `useCreateNocoViewSort` | `useCreateViewSort` |
| `useDeleteNocoViewSort` | `useDeleteViewSort` |
| `useNocoViewFilters` | `useViewFilters` |
| `useCreateNocoViewFilter` | `useCreateViewFilter` |
| `useDeleteNocoViewFilter` | `useDeleteViewFilter` |

**In `use-columns.ts` (was `use-nocodb-columns.ts`):**

| Old | New |
|---|---|
| `NocoDBColumn` (interface) | `SchemaColumn` |
| `["nocodb-columns", resource]` (query key) | `["columns", resource]` |

**In `crm.ts` (merged from `crm-nocodb.ts`):**

| Old | New |
|---|---|
| `parseNocoWhereToFilters` | `parseWhereToFilters` |
| `setNocoSalesId` | `setSalesId` |

**In `field-type-map.ts` (was `nocodb-map.ts`):**

| Old | New |
|---|---|
| `mapNocoUidtToFieldType` | `mapUidtToFieldType` |
| `mapFieldTypeToNocoUidt` | `mapFieldTypeToUidt` |

---

### E3 — Query key renames

TanStack Query uses string keys for caching. Renaming them means cached data from the old keys is abandoned — fine since they only exist in memory.

| Old key | New key |
|---|---|
| `["noco-views", resource]` | `["views", resource]` |
| `["noco-view-columns", viewId]` | `["view-columns", viewId]` |
| `["noco-view-sorts", viewId]` | `["view-sorts", viewId]` |
| `["noco-view-filters", viewId]` | `["view-filters", viewId]` |
| `["nocodb-columns", resource]` | `["columns", resource]` |

Query keys appear in both the hook file and wherever `qc.invalidateQueries` is called — update all call sites together.

---

### E4 — Import updates

Every file that imports from the renamed modules needs its import path updated. The full list from grep:

| File | Old import | New import |
|---|---|---|
| `src/hooks/use-views.ts` | `from "@/hooks/use-noco-views"` | `from "@/hooks/use-view-queries"` |
| `src/hooks/use-records.ts` | `from "@/lib/api/crm-nocodb"` | `from "@/lib/api/crm"` |
| `src/lib/api/crm.ts` | `import * as nocoApi from "./crm-nocodb"` | collapse — no re-export needed |
| `src/hooks/use-contacts.ts` | `from "@/lib/nocodb/field-mapper"` | `from "@/lib/crm/field-mapper"` |
| `src/hooks/use-companies.ts` | `from "@/lib/nocodb/field-mapper"` | `from "@/lib/crm/field-mapper"` |
| `src/hooks/use-deals.ts` | `from "@/lib/nocodb/field-mapper"` | `from "@/lib/crm/field-mapper"` |
| `src/hooks/use-tasks.ts` | `from "@/lib/nocodb/field-mapper"` | `from "@/lib/crm/field-mapper"` |
| `src/field-types/index.ts` | `from "./nocodb-map"` | `from "./field-type-map"` |
| `src/providers/ObjectRegistryProvider.tsx` | `from "@/hooks/use-nocodb-columns"` | `from "@/hooks/use-columns"` |
| `src/components/command-palette.tsx` | `from "@/lib/nocodb/field-mapper"` | `from "@/lib/crm/field-mapper"` |
| `src/components/manage-columns-dialog.tsx` | `from "@/hooks/use-nocodb-columns"` | `from "@/hooks/use-columns"` |
| `src/components/create-attribute/CreateAttributeModal.tsx` | `from "@/hooks/use-nocodb-columns"` | `from "@/hooks/use-columns"` |
| `src/components/spreadsheet/SpreadsheetGrid.tsx` | `from "@/hooks/use-nocodb-columns"` | `from "@/hooks/use-columns"` |
| `src/components/spreadsheet/ExpandedRowModal.tsx` | `from "@/hooks/use-nocodb-columns"` | `from "@/hooks/use-columns"` |
| `src/components/spreadsheet/AddColumnDialog.tsx` | `from "@/hooks/use-nocodb-columns"` | `from "@/hooks/use-columns"` |

---

### E5 — Stale comments to update

| File | Old comment | Replacement |
|---|---|---|
| `src/App.tsx:80` | `{/* Records (NocoDB-backed objects) */}` | `{/* Records (object-registry backed objects) */}` |
| `src/hooks/use-views.ts:335` | `// Save — persist all dirty changes to NocoDB` | `// Save — persist all dirty changes` |
| `src/components/pages/ObjectListPage.tsx:471` | `{/* ---- Create attribute modal (for adding new NocoDB columns) ---- */}` | `{/* ---- Create attribute modal ---- */}` |
| `src/providers/ObjectRegistryProvider.tsx` | Multiple comments referencing NocoDB | Replace with "schema API" or "column metadata" |
| `src/lib/nocodb/filters.ts` | All doc comments | Update to remove NocoDB references |
| `src/lib/nocodb/field-mapper.ts` | All doc comments | Update to remove NocoDB references |

---

### E6 — Secondary: view type encoding

The `views` table has `type character varying(32) default 'grid'` but the create mutation sends a numeric type code (`3` for grid, `2` for kanban) via `VIEW_TYPE_TO_NOCO`. If the backend converts this before storage, confirm and remove the numeric map. If it stores the number as a string (`"3"`), fix the backend to accept and store the string type name directly (`"grid"`, `"kanban"`) and remove `VIEW_TYPE_MAP` / `VIEW_TYPE_TO_NOCO` entirely from `use-views.ts`.

---

### E7 — Execution order

Do E in a single commit to avoid a partially-renamed state:
1. Rename files (git mv keeps history)
2. Update all imports
3. Rename interfaces, hooks, query keys, functions
4. Update comments
5. Run `make typecheck` + `make lint` to catch missed references
