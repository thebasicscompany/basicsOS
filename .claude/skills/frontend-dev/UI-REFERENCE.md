# UI Architecture Reference

Complete reference for every page, component, hook, field type, and interaction pattern in BasicsOS. Consult before making UI changes to avoid breaking existing functionality.

---

## 1. App Shell & Routing

### Entry Point
- `src/App.tsx` defines all routes
- `src/layouts/AppLayout.tsx` wraps protected routes with SidebarProvider, PageHeaderProvider, ErrorBoundary

### Layout Architecture
```
SidebarProvider
  PageHeaderProvider
    Header (52px) — sidebar trigger, page title (portal), breadcrumbs (portal), actions (portal)
    Row: AppSidebar + SidebarInset
      LayoutContent — ErrorBoundary + Outlet
```

### Portal Systems (`src/contexts/page-header/`)
- `usePageTitle()` — set document/page title
- `usePageHeaderTitle()` — render custom title content
- `usePageHeaderActions()` — register action buttons (sort, filter, create) in header
- `useRegisterActionsContainer()` — register the actions container element
- `usePageHeaderBreadcrumb()` — set breadcrumb content
- `useRegisterBreadcrumbContainer()` — register the breadcrumb container element
- `useRegisterTitleSlotContainer()` — register title slot container
- `usePageHeaderTitleSlot()` — get title slot content
- `useTitleSlotInUse()` — check if title slot is active

### Providers (wrap all protected routes)
Outer to inner in `src/App.tsx`:
- `QueryClientProvider` — TanStack Query client
- `ThemeProvider` — light/dark/system theme
- `BrowserRouter` — React Router
- `TooltipProvider` — Radix tooltip context

Then in `src/layouts/AppLayout.tsx`:
- `SidebarProvider` — collapsible sidebar state
- `PageHeaderProvider` — header portal context (title, breadcrumb, actions)
- `ProtectedRoute` — auth guard
- `ObjectRegistryProvider` — object configs + attributes
- `GatewayProvider` — AI gateway token (fetches from `/api/gateway-token`, creates `manageClient`)
- `CommandPalette` — Cmd+K search

### Page Visit Tracking
`useRecentPages()` in AppLayout stores recent pages (icon, label, timestamp) to localStorage key `crm:recent-pages`. Skips home page.

### Layout Padding Variants
AppLayout applies different header/content padding based on route:
- **Builder pages** (`/automations/create`, `/automations/:id`) — minimal padding for canvas
- **Record detail pages** (`/objects/:slug/:id`) — adjusted for detail layout
- **Regular pages** — standard padding

---

## 2. Routes

### Public
| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `StartPage` | Auth redirect (checks session + first-user init) |
| `/sign-up` | `SignupPage` | First-user setup or invite-based signup |

### Protected
| Path | Component | Key Hooks | Features |
|------|-----------|-----------|----------|
| `/home` | `HomePage` | useMe, useGateway, useThreads | Greeting, recent records/chats, chat input |
| `/objects/:objectSlug` | `ObjectListPage` | useObject, useAttributes, useRecords, useViews, useViewState | Data table, views, sort/filter, kanban (deals), create record |
| `/objects/:objectSlug/:recordId` | `RecordDetailPage` | useRecordDetail | Detail tabs, sidebar fields, inline name edit, notes, prev/next nav |
| `/chat` | `ChatPage` | useGatewayChat, useThreadMessages | AI chat with streaming, attachments, suggestions |
| `/chat/:threadId` | `ChatPage` | useGatewayChat, useThreadMessages | Thread history |
| `/profile` | `ProfilePage` | useMe | Edit name, change password, sign out |
| `/settings` | `SettingsPage` | useMe, useOrganization, useTheme, useAdminAiConfig, useRbacRoles/Users | Theme, AI config, org, invites, roles, connections |
| `/admin/usage` | `UsagePage` | useAdminUsageSummary, useAdminUsageLogs | Token usage, request logs (admin only) |
| `/tasks` | `TasksPage` | useTasks, useContacts | Task grouping by due date, create, mark done |
| `/notes` | `NotesPage` | useQuery (deal/contact notes) | Note lists with pagination |
| `/import` | `ImportPage` | (ImportWizard) | CSV import wizard |
| `/automations` | `AutomationsApp` | (sub-app) | List automations |
| `/automations/create` | `AutomationBuilderPage` | (sub-app) | Workflow builder |
| `/automations/:id` | `AutomationBuilderPage` | (sub-app) | Edit automation |
| `/voice` | `VoiceApp` | Electron API | Mic selection, shortcuts (Electron only) |
| `/mcp` | `MCPViewerApp` | — | MCP server viewer (stub) |

### Redirects
| From | To |
|------|----|
| `/connections` | `/settings#connections` (preserves query string) |
| `/contacts` | `/objects/contacts` |
| `/contacts/:id` | `/objects/contacts/:id` |
| `/companies` | `/objects/companies` |
| `/companies/:id` | `/objects/companies/:id` |
| `/deals` | `/objects/deals` |
| `/deals/:id` | `/objects/deals/:id` |
| `/dashboard` | `/home` |
| `*` | `/home` |

### Dead Code Note
`ConnectionsPage.tsx` exists in `src/components/pages/` but is never imported in App.tsx — replaced by redirect + `ConnectionsContent` embedded in SettingsPage.

---

## 3. Component Areas

### Root Components (`src/components/`)

| File | Component | Purpose |
|------|-----------|---------|
| `app-sidebar.tsx` | `AppSidebar` | Main sidebar with ChatThreadsNav, AutomationsNav, ObjectRegistryNavSection |
| `command-palette.tsx` | `CommandPalette` | Cmd+K search & navigation |
| `nav-user.tsx` | `NavUser` | User dropdown in sidebar footer (sign out, settings, profile) |
| `ObjectRegistryNavSection.tsx` | `ObjectRegistryNavSection` | Dynamic object nav items with create object button |
| `error-fallback.tsx` | `ErrorFallback` | React error boundary fallback |
| `filter-chips.tsx` | `FilterChips` | Pill-style filter buttons |
| `status-badge.tsx` | `SelectBadge`, `DealStageBadge`, `ContactStatusBadge` | Color-coded badges |
| `markdown-content.tsx` | `MarkdownContent` | Markdown renderer with prose styling |
| `nav-main.tsx` | `NavGroup` | Collapsible nav group sections (props: `{ label, items }`) |

### Cells (`src/components/cells/`)

| File | Component | Purpose |
|------|-----------|---------|
| `Cell.tsx` | `Cell` | Universal cell for table display/edit; delegates to field type's CellDisplay/CellEditor |
| `DetailField.tsx` | `DetailField` | Inline edit field for record detail sidebar |

**Cell props:** `{ attribute, value, isEditing, isSelected, onStartEditing, onSave, onCancel }`
- Toggle-style types (checkbox) edit inline without entering edit mode
- Shows placeholder for empty values

### Data Table (`src/components/data-table/`)

| File | Component/Export | Purpose |
|------|-----------------|---------|
| `DataTable.tsx` | `DataTable` | Main table with rows, headers, pagination |
| `useDataTable.tsx` | `useDataTable` | Hook: selection, editing, columns, pagination state |
| `DataTableHeader.tsx` | `DataTableHeader` | Header row with resize handles & column menus |
| `DataTableBody.tsx` | `DataTableBody` | Table rows with cell click/edit handlers |
| `DataTablePagination.tsx` | `DataTablePagination` | Page controls (page, perPage) |
| `DataTableToolbar.tsx` | `DataTableToolbar`, `ColumnsPopover` | Sort/filter/columns UI |
| `ColumnHeaderMenu.tsx` | `ColumnHeaderMenu` | Column dropdown (sort, rename, hide, move) |
| `SortPopover.tsx` | `SortPopover` | Sort configuration UI |
| `FilterPopover.tsx` | `FilterPopover` | Filter configuration UI |
| `SortableHeaderCell.tsx` | `SortableHeaderCell` | Drag-sortable column header |
| `ColumnResizeHandle.tsx` | `ColumnResizeHandle` | Column resize drag handle |
| `ViewSelector.tsx` | `ViewSelector` | View tabs with CRUD |
| `SortFilterPills.tsx` | `SortFilterPills` | Active sort/filter display pills |
| `column-items.ts` | `buildColumnItems` | Column definition builder |
| `utils.ts` | Utilities | Parse width, get visible attrs |

**DataTable props:** `objectSlug, singularName, pluralName, attributes, data, viewColumns, pagination, onCellUpdate, onRowExpand, onRowDelete, onNewRecord, onAddColumn, onColumnResize, onAddSort, onHideColumn, onRenameColumn`

### Record Detail (`src/components/record-detail/`)

| File | Component | Purpose |
|------|-----------|---------|
| `useRecordDetail.tsx` | `useRecordDetail` | Composite hook: object, record, display name, edit modes, tabs, navigation |
| `RecordDetailDetailsSidebar.tsx` | `RecordDetailDetailsSidebar` | Editable field list with show/hide empty toggle |
| `EditableRecordName.tsx` | `EditableRecordName` | Inline name editor (single or split first/last) |
| `RecordDetailHeaderActions.tsx` | `RecordDetailHeaderActions` | Favorite, duplicate, prev/next nav, delete |
| `RecordDetailBreadcrumb.tsx` | `RecordDetailBreadcrumb` | Breadcrumb navigation |
| `NotesTabContent.tsx` | `NotesTabContent` | Notes tab with create/edit/delete |
| `RecordDetailDeleteDialog.tsx` | `RecordDetailDeleteDialog` | Delete confirmation |
| `DetailSkeleton.tsx` | `DetailSkeleton` | Loading skeleton |

**useRecordDetail returns:** objectSlug, recordId, obj, record, attributes, displayName, nameFieldLabel, nameEditorMode, activeTab, setActiveTab, confirmDeleteOpen, showAllFields, visibleEditableAttributes, systemAttributes, hiddenCount, emptyFieldsCount, handleNameSave, handleFieldSave, handleDelete, handleDuplicate, listIdsLength, prevId, nextId, onPrev, onNext

### Object List (`src/components/object-list/`)

| File | Component | Purpose |
|------|-----------|---------|
| `ObjectListHeaderActions.tsx` | `ObjectListHeaderActions` | Sort/filter/columns/create buttons in header |
| `ObjectListViewTabs.tsx` | `ObjectListViewTabs` | View selector tabs |
| `ObjectListSortFilterPills.tsx` | `ObjectListSortFilterPills` | Active sort/filter pills |
| `DealsLayoutToggle.tsx` | `DealsLayoutToggle` | Table/kanban toggle (deals only) |

### Create Record (`src/components/create-record/`)

| File | Component | Purpose |
|------|-----------|---------|
| `CreateRecordModal.tsx` | `CreateRecordModal` | Dialog for new records; "create more" toggle, Cmd+Enter submit |
| `RecordForm.tsx` | `RecordForm` | Dynamic form from Attribute[] + values/onChange; primary field first |

### Create Attribute (`src/components/create-attribute/`)

| File | Component | Purpose |
|------|-----------|---------|
| `CreateAttributeModal.tsx` | `CreateAttributeModal` | Two-step: type grid -> name + config |
| `EditAttributeDialog.tsx` | `EditAttributeDialog` | View/edit field configuration |

### Create Object (`src/components/create-object/`)

| File | Component | Purpose |
|------|-----------|---------|
| `CreateObjectModal.tsx` | `CreateObjectModal` | Create custom object (icon, name, fields) |

### Deals (`src/components/deals/`)

| File | Component | Purpose |
|------|-----------|---------|
| `DealsKanbanBoard.tsx` | `DealsKanbanBoard` | Drag-drop kanban by stage; show/hide stages |

### Import (`src/components/import/`)

| File | Purpose |
|------|---------|
| `ImportWizard.tsx` | Multi-step wizard (file -> object -> map -> merge -> preview -> execute) |
| `ImportFileDropzone.tsx` | CSV file upload |
| `ImportObjectSelector.tsx` | Target object picker |
| `ImportColumnMapper.tsx` | Map CSV headers to fields |
| `ImportMergeOptions.tsx` | Merge key & conflict behavior |
| `ImportPreviewTable.tsx` | Preview mapped data |
| `ImportProgress.tsx` | Import progress bar |
| `ImportCreateFieldPrompt.tsx` | Create missing field on-the-fly during column mapping |
| `import-utils.ts` | CSV parsing utilities |

### AI Elements (`src/components/ai-elements/`)

| File | Purpose |
|------|---------|
| `prompt-input.tsx` | Chat input (textarea, attachments, submit) |
| `prompt-input-context.ts` | Attachments & references context |
| `conversation.tsx` | Message list (StickToBottom) |
| `message.tsx` | User/assistant message with MessageResponse |
| `attachments.tsx/context/utils` | File attachment handling |
| `node.tsx, edge.tsx, canvas.tsx, connection.tsx` | Workflow canvas (React Flow) |
| `model-selector.tsx` | LLM model picker |
| `shimmer.tsx` | Thinking indicator |
| `suggestion.tsx` | Suggested prompts |
| `controls.tsx` | `WorkflowControls` — workflow canvas zoom/fit controls |
| `panel.tsx` | `Panel` — workflow canvas side panel |
| `conversation-utils.ts` | Message formatting utilities |

### Home (`src/components/home/`)

| File | Purpose |
|------|---------|
| `home-sections.tsx` | RecentRecordsSection, RecentsSection, RecentChatsSection |

### Auth (`src/components/auth/`)

| File | Component | Purpose |
|------|-----------|---------|
| `start-page.tsx` | `StartPage` | Landing page |
| `login-page.tsx` | `LoginPage` | Login form |
| `signup-page.tsx` | `SignupPage` | Signup form |

### Connections (`src/components/connections/`)

| File | Component | Purpose |
|------|-----------|---------|
| `ConnectionsContent.tsx` | `ConnectionsContent` | OAuth cards (Slack, Gmail) |

### Sheets (`src/components/sheets/`)

| File | Component | Purpose |
|------|-----------|---------|
| `ContactSheet.tsx` | `ContactSheet` | Contact detail sheet (legacy, superseded by generic record form) |

### Shadcn UI (`src/components/ui/`) — 50+ components

**Layout:** sidebar, card, separator, scroll-area
**Forms:** input, input-group, label, textarea, checkbox, radio-group, toggle, toggle-group, select, switch, calendar
**Dropdowns:** dropdown-menu, context-menu, command
**Overlays:** dialog, drawer, sheet, popover, hover-card
**Feedback:** alert, badge, skeleton, spinner, progress, sonner (toast)
**Navigation:** breadcrumb, pagination, tabs, navigation-menu
**Data:** table, sortable (dnd), faceted
**Charts:** chart (recharts)
**Special:** animated-border, item, empty-state, kbd, button, button-group

---

## 4. Field Types

### Registry (`src/field-types/registry.ts`)

```typescript
getFieldType(key: string): FieldTypeDefinition   // falls back to text
getAllFieldTypes(): FieldTypeDefinition[]
getFieldTypesByGroup(): Record<string, FieldTypeDefinition[]>
hasFieldType(key: string): boolean
registerFieldType(definition: FieldTypeDefinition): void
```

### FieldTypeDefinition Shape
Each field type provides: `CellDisplay`, `CellEditor`, `DetailEditor`, `FormInput`, `KanbanDisplay`, `KanbanEditor`, optional `TypeConfig`, `validate()`, `isEmpty()`, `parseValue()`, `serializeValue()`, `formatDisplayValue()`, `filterOperators[]`, `availableCalculations[]`, `comparator()`, `editorStyle` (inline|popover|expanding|toggle), `placeholder`, `searchPlaceholder`.

### All 18 Field Types

| Key | Label | Group | EditorStyle | TypeConfig | Filter Operators |
|-----|-------|-------|-------------|------------|-----------------|
| `text` | Text | standard | inline | No | like, nlike, eq, neq, is_empty, is_not_empty |
| `long-text` | Long Text | standard | expanding | No | like, nlike, is_empty, is_not_empty |
| `number` | Number | standard | inline | No | eq, neq, gt, gte, lt, lte, is_empty, is_not_empty |
| `currency` | Currency | standard | inline | No | eq, neq, gt, gte, lt, lte, is_empty, is_not_empty |
| `select` | Select | standard | popover | Yes (options+colors) | eq, neq, is_empty, is_not_empty |
| `multi-select` | Multi Select | standard | expanding | Yes (options+colors) | contains, not_contains, is_empty, is_not_empty |
| `status` | Status | standard | popover | Yes (options+colors+order) | eq, neq, is_empty, is_not_empty |
| `checkbox` | Checkbox | standard | toggle | No | eq, neq |
| `date` | Date | standard | popover | No | eq, neq, gt, lt, is_empty, is_not_empty |
| `timestamp` | Timestamp | standard | popover | No | eq, gt, lt, is_empty, is_not_empty |
| `rating` | Rating | standard | inline | No | eq, gt, gte, lt, lte, is_empty, is_not_empty |
| `email` | Email | standard | inline | No | like, eq, neq, is_empty, is_not_empty |
| `domain` | URL | standard | inline | No | like, eq, is_empty, is_not_empty |
| `phone` | Phone | standard | inline | No | like, eq, is_empty, is_not_empty |
| `location` | Location | standard | popover | Yes (show city/state/country) | like, is_empty, is_not_empty |
| `user` | User | standard | popover | No | eq, neq, is_empty, is_not_empty |
| `relationship` | Link to Record | relational | popover | Yes (relatedTable, allowMultiple, displayField) | contains, is_empty, is_not_empty |
| `company` | Company | relational | popover | No | eq, is_empty, is_not_empty |

### Value Transform Patterns
- **Text/Email/Domain/Phone:** string -> string, empty string -> null
- **Number/Currency/Rating:** string -> number, empty/invalid -> null
- **Select/Status:** stores option ID/label as string
- **Multi-select:** stores as array; comma-separated strings split on parse
- **Checkbox:** true/1/"true" -> true, else false
- **Date:** ISO date string (YYYY-MM-DD)
- **Timestamp:** ISO timestamp, displays as "time ago"
- **Location:** JSON object `{ city?, state?, country? }`, fallback comma-separated parse
- **User:** object `{ id, name?, email?, avatarUrl? }`
- **Relationship:** array of `{ id, title?, tableName? }`
- **Company:** integer company ID

### Color System (12 colors)
Yellow, Cyan, Olive, Red, Green, Teal, Purple, Blue, Orange, Pink, Indigo, Amber — each with bg/text/border classes. Shared `ColorPickerDot` popover component.

---

## 5. Hooks Reference

### Record Hooks (`src/hooks/use-records.ts`)

| Hook | Query Key | API | Invalidates |
|------|-----------|-----|-------------|
| `useRecords(slug, params?)` | `["records", slug, {page,perPage,sort,filter,viewFilters}]` | GET `/api/{slug}` | — |
| `useRecord(slug, id)` | `["records", slug, "detail", id]` | GET `/api/{slug}/{id}` | — |
| `useCreateRecord(slug)` | — | POST `/api/{slug}` | `["records", slug]` |
| `useUpdateRecord(slug)` | — | PUT `/api/{slug}/{id}` | `["records", slug]`, `["records", slug, "detail", id]` (optimistic) |
| `useDeleteRecord(slug)` | — | DELETE `/api/{slug}/{id}` | `["records", slug]` |

### Legacy Object Hooks (contacts, companies, deals, tasks)

| Hook | Query Key | Invalidates |
|------|-----------|-------------|
| `useContacts(params?)` | `["contacts_summary", params]` | — |
| `useContact(id)` | `["contacts", id]` | — |
| `useCreateContact()` | — | contacts_summary, contacts, companies_summary |
| `useUpdateContact()` | — | contacts_summary, contacts[id], companies_summary |
| `useDeleteContact()` | — | contacts_summary, contacts, companies_summary, tasks |
| `useCompanies(params?)` | `["companies_summary", params]` | — |
| `useCreateCompany()` | — | companies_summary, companies |
| `useUpdateCompany()` | — | companies_summary, companies[id], contacts_summary |
| `useDeleteCompany()` | — | companies_summary, companies, contacts_summary |
| `useDeals(params?)` | `["deals", params]` | — |
| `useCreateDeal()` | — | deals, companies_summary |
| `useUpdateDeal()` | — | deals, deals[id], companies_summary |
| `useDeleteDeal()` | — | deals, companies_summary |
| `useTasks()` | `["tasks"]` | — |
| `useCreateTask()` | — | tasks, contacts_summary |
| `useMarkTaskDone()` | — | tasks |
| `useDeleteTask()` | — | tasks, contacts_summary, contacts |

### Notes Hooks

| Hook | Query Key | Invalidates |
|------|-----------|-------------|
| `useContactNotes(contactId)` | `["contact_notes", contactId]` | — |
| `useCreateContactNote()` | — | contact_notes[contactId] |
| `useDeleteContactNote()` | — | contact_notes[contactId] |
| `useDealNotes(dealId)` | `["deal_notes", dealId]` | — |
| `useCreateDealNote()` | — | deal_notes[dealId] |
| `useDeleteDealNote()` | — | deal_notes[dealId] |

### View Hooks (`src/hooks/use-views.ts`, `use-view-queries.ts`)

| Hook | Query Key | Invalidates |
|------|-----------|-------------|
| `useViews(slug)` | (uses useViewList) | — |
| `useViewList(slug)` | `["views", slug]` | — |
| `useViewColumns(viewId)` | `["view-columns", viewId]` | — |
| `useCreateViewColumn(viewId)` | — | view-columns[viewId] |
| `useUpdateViewColumn(viewId)` | — | view-columns[viewId] |
| `useViewSorts(viewId)` | `["view-sorts", viewId]` | — |
| `useCreateViewSort(viewId)` | — | view-sorts[viewId] |
| `useDeleteViewSort(viewId)` | — | view-sorts[viewId] |
| `useViewFilters(viewId)` | `["view-filters", viewId]` | — |
| `useCreateViewFilter(viewId)` | — | view-filters[viewId] |
| `useDeleteViewFilter(viewId)` | — | view-filters[viewId] |
| `useRenameView(slug)` | — | views[slug] |
| `useDeleteView(slug)` | — | views[slug] |

`useViewState(viewId)` manages local columns/sorts/filters with dirty tracking; `save()` deletes old server config and creates new.

### Object Registry Hooks (`src/hooks/use-object-registry.ts`)

| Hook | Returns |
|------|---------|
| `useObjectRegistry()` | Full context: objects, getObject, getAttributes, isLoading, error |
| `useObjects()` | All active ObjectConfig[] |
| `useObject(slug)` | Single ObjectConfig |
| `useAttributes(slug)` | Merged Attribute[] (schema + overrides) |
| `useUpdateObjectConfig(slug)` | Mutation; invalidates object-config, columns |

### Column Hooks (`src/hooks/use-columns.ts`)

| Hook | Query Key | Invalidates |
|------|-----------|-------------|
| `useTableColumns(resource)` | `["columns", resource]` | — |
| `useCreateColumn()` | — | columns, object-config |
| `useUpdateColumn()` | — | columns, object-config |
| `useDeleteColumn()` | — | columns |

### User & Auth Hooks

| Hook | Query Key |
|------|-----------|
| `useMe()` | `["me"]` |
| `useOrganization()` | `["organization"]` |
| `useThreads(limit?)` | `["threads", limit]` |
| `useThreadMessages(threadId)` | `["thread-messages", threadId]` |

### Admin Hooks (`src/hooks/use-admin.ts`)

| Hook | Query Key | Invalidates |
|------|-----------|-------------|
| `useAdminAiConfig(enabled)` | `["admin", "ai-config"]` | — |
| `useSaveAdminAiConfig()` | — | admin/ai-config, me |
| `useClearAdminAiConfig()` | — | admin/ai-config, me |
| `useSaveAdminTranscriptionByok()` | — | admin/ai-config |
| `useAdminUsageLogs(enabled, days?)` | `["admin", "usage", "logs", days]` | — |
| `useAdminUsageSummary(enabled, days?)` | `["admin", "usage", "summary", days]` | — |

### RBAC Hooks (`src/hooks/use-rbac.ts`)

| Hook | Query Key | Invalidates |
|------|-----------|-------------|
| `useRbacRoles(enabled?)` | `["rbac_roles"]` | — |
| `useRbacUsers(enabled?)` | `["rbac_users"]` | — |
| `useAssignRbacRole()` | — | rbac_users |

### Favorites Hooks (`src/hooks/use-favorites.ts`)

| Hook | Query Key | Invalidates |
|------|-----------|-------------|
| `useFavorites(slug?)` | `["favorites", slug ?? "all"]` | — |
| `useToggleFavorite()` | — | favorites[slug], favorites/all |
| `useIsFavorite(slug, id)` | (derived) | — |

### Gateway Chat Hook (`src/hooks/useGatewayChat.ts`)

`useGatewayChat(opts?)` — uses ai-sdk's useChat; POST `/api/gateway-chat`; on finish invalidates contacts_summary, deals, companies_summary, tasks, contact_notes, threads.

### Utility Hooks (Local State)

| Hook | Storage Key | Purpose |
|------|-------------|---------|
| `useRecentItems()` | `crm:recent` | Last 6 visited records |
| `useRecentPages()` | `crm:recent-pages` | Last 8 visited pages |
| `useGridPreferences(resource)` | `grid-prefs-{resource}` | Row height, column sizing/order/visibility |
| `useKeyboardNavigation(opts)` | (in-memory) | Arrow/tab/enter/escape cell navigation |
| `useImport()` | (in-memory) | Import wizard state machine |
| `useCallbackRef(callback)` | (in-memory) | Converts callback to stable ref (Radix pattern) |
| `useDebouncedCallback(cb, delay)` | (in-memory) | Debounces function calls |
| `executeImport()` | (function, not hook) | Batch import execution (batch size 25) |

---

## 6. API Layer

### Core (`src/lib/api.ts`)

- `fetchApi(path, options?)` — generic fetch with credentials:"include", JSON, throws `ApiError`
- `fetchApiList(path, options?)` — fetches list with Content-Range header for total
- `ApiError` — extends Error; has code?, details?, status?

### CRM Functions (`src/lib/api/crm.ts`)

- `getList(resource, params?)` — GET `/api/{resource}` with pagination, sort, filter
- `getOne(resource, id)` — GET `/api/{resource}/{id}`
- `create(resource, data)` — POST `/api/{resource}`
- `update(resource, id, data)` — PUT `/api/{resource}/{id}` (strips id fields)
- `remove(resource, id)` — DELETE `/api/{resource}/{id}`
- `parseWhereToFilters(where)` — legacy NocoDB "(field,op,value)" parser

### Display Name (`src/lib/crm/display-name.ts`)

- `getNameAttributes(attributes)` — find primary name attribute(s) for an object
- `getRecordDisplayName(record, attributes)` — resolve display name from record data
- `parseCombinedName(value)` — split "First Last" into parts
- `getAttributeDisplayName(attribute)` — human-readable attribute label
- `isNameFieldId(fieldId)` — check if field is a name-type field
- `shouldHideSplitNameAttribute(attribute)` — check if split name parts should be hidden in detail view

### Gateway Tools (`src/lib/gateway/tools/`)

CRM tool definitions for AI chat function calling:
- `contacts.ts` — contact search/create/update tools
- `deals.ts` — deal tools
- `companies.ts` — company tools
- `tasks.ts` — task tools
- `notes.ts` — note tools
- `types.ts` — shared tool type definitions
- All exported via `ALL_CRM_TOOLS` aggregate

### Type Definitions

- `src/types/objects.ts` — `Attribute`, `ObjectConfig`, `AttributeOverride`, `ObjectConfigApiResponse`
- `src/types/views.ts` — `ViewConfig`, `ViewColumn`, `ViewSort`, `ViewFilter`, `ViewState`

### Config

- `src/config/sidebar-nav.ts` — `SIDEBAR_NAV_APPS`, `SIDEBAR_NAV_AUTOMATIONS` (sidebar navigation item config)

### Auth Client

- `src/lib/auth-client.ts` — Better Auth client; `authClient` for sign-in/sign-out/session

### TanStack Query Config
- `staleTime: 60_000` (1 minute)
- `retry: 1`

---

## 6b. Electron / Overlay System

Desktop Electron integration lives outside the main web app:

| Directory | Purpose |
|-----------|---------|
| `src/main/` | Electron main process: `index.ts`, `hold-key-detector`, `meeting-manager-stub`, `settings-store`, `shortcut-manager` |
| `src/overlay/` | Voice overlay app: `OverlayApp`, `api`, `lib/`, `meeting-recorder-stub` |
| `src/preload/` | Electron preload scripts (IPC bridge) |
| `src/renderer/` | Electron renderer entry |
| `src/shared-overlay/` | Shared overlay utilities |

These directories are only active in the Electron build. The web app (`/voice` route) shows a stub UI with instructions. Electron-specific code should not be imported from web components.

---

## 7. Key Patterns

### Cell Editing Flow
1. Click cell -> select (highlight)
2. Double-click or type -> enter edit mode
3. Field type's CellEditor renders
4. Blur or Enter -> `onCellUpdate` called with `buildAttributeWritePayload()`
5. Escape -> cancel edit
6. Toggle types (checkbox) skip edit mode — click toggles directly

### View Persistence (NocoDB-style)
- Multiple named views per object, each with columns/sorts/filters
- `useViewState(viewId)` tracks local changes with dirty flag
- `save()` deletes old server config, creates new columns/sorts/filters
- View selection stored in URL `?view=` param

### Record Name Editing
- `EditableRecordName` supports "single" mode (one name field) and "split" mode (firstName + lastName)
- "heading" variant in page title, "field" variant in detail sidebar
- Double-click to edit, Enter to save, Escape to cancel

### Value Transform Pipeline
1. Raw DB value -> `parseValue()` (field type normalizes)
2. Display: `formatDisplayValue()` or `CellDisplay` component
3. Edit: CellEditor works with parsed value
4. Save: `serializeValue()` converts back for API
5. API payload: `buildAttributeWritePayload()` handles custom vs standard field mapping

### Custom vs Standard Fields
- Standard fields: direct columns on table (e.g., `name`, `email`)
- Custom fields: stored in `customFields` JSON column, prefixed with `custom_`
- `useUpdateRecord` merges customFields in optimistic update
- `buildAttributeWritePayload` routes to correct location

### Invalidation Cascades
- Contact changes -> invalidate companies_summary (contact count)
- Company changes -> invalidate contacts_summary (company name display)
- Deal changes -> invalidate companies_summary
- Task deletion -> invalidate contacts_summary, contacts
- Gateway chat finish -> invalidate ALL major data keys
- Object config changes -> invalidate object-config + columns

### Keyboard Navigation (DataTable)
- Arrow keys move active cell
- Tab moves to next cell
- Enter starts editing / confirms edit
- Escape cancels edit
- Managed by `useKeyboardNavigation` hook

### URL State
- `page`, `perPage` in search params for pagination
- `layout` param for deals (table/kanban)
- `?view=` for active view selection
- `#notes` anchor for record detail tab

---

## 8. Building New Features

### Adding a New Page
1. Create component in `src/components/pages/`
2. Add route in `src/App.tsx` under protected routes
3. Use `usePageHeaderTitle()` and `usePageHeaderActions()` for header integration
4. Add nav item in `app-sidebar.tsx` if needed

### Adding a New Field Type
1. Create directory `src/field-types/types/{name}/`
2. Implement `FieldTypeDefinition` with all required components
3. Register in `src/field-types/registry.ts`
4. Add UIDT mapping in `src/field-types/field-type-map.ts` if migrating from NocoDB
5. Add to type grid in `CreateAttributeModal` if user-creatable

### Adding a New Object
Objects are DB-driven via `object_config` table. No code changes needed for basic objects. Custom behavior requires:
1. Check if `ObjectListPage` / `RecordDetailPage` need object-specific branches
2. Add special layout toggle (like deals kanban) if needed

### Adding a Modal/Dialog
1. Use Shadcn `Dialog` from `@/components/ui/dialog`
2. Control open state in parent via `open` + `onOpenChange` props
3. For forms, use `RecordForm` pattern (attributes + values + onChange)
4. For confirmation, use `AlertDialog` pattern (like `RecordDetailDeleteDialog`)

### Adding a New Hook
1. Place in `src/hooks/`
2. For queries: use `useQuery` with descriptive key array
3. For mutations: use `useMutation` with `onSuccess` invalidation
4. Document query key pattern for other developers
5. Consider cross-invalidation (does this mutation affect other queries?)

### Avoiding Breaking Changes
- Never rename query keys without updating all invalidation sites
- Never change field type `parseValue`/`serializeValue` without migration
- Test with existing data — empty values, legacy formats, custom fields
- Check both list view (DataTable) and detail view (RecordDetailDetailsSidebar)
- Check form view (CreateRecordModal) for new/changed fields
- Verify kanban view if changing deal-related fields
