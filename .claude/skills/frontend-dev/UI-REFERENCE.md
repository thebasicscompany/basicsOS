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

### CRM Object Routes
| Path | Component | Key Hooks | Features |
|------|-----------|-----------|----------|
| `/objects/:objectSlug` | `ObjectListPage` | useObject, useAttributes, useRecords, useViews, useViewState | Data table, views, sort/filter, kanban (deals), create record |
| `/objects/:objectSlug/:recordId` | `RecordDetailPage` | useRecordDetail | Detail tabs, sidebar fields, inline name edit, notes, prev/next nav |

### App Routes
| Path | Component (app) | Key Hooks | Features |
|------|-----------------|-----------|----------|
| `/home` | `HomePage` | useMe, useGateway, useThreads | Greeting, recent records/chats, chat input |
| `/chat` | `ChatPage` | useGatewayChat, useThreadMessages | AI chat with streaming, attachments, suggestions |
| `/chat/:threadId` | `ChatPage` | useGatewayChat, useThreadMessages | Thread history |
| `/tasks` | `TasksPage` | useTasks, useContacts | Task grouping by due date, create, mark done |
| `/notes` | `NotesPage` | useQuery (deal/contact notes) | Note lists with pagination |
| `/import` | `ImportPage` | (ImportWizard) | CSV import wizard |
| `/automations` | `AutomationsApp` (app) | (sub-router) | List automations |
| `/automations/create` | `AutomationBuilderPage` (app) | (sub-router) | Workflow builder |
| `/automations/:id` | `AutomationBuilderPage` (app) | (sub-router) | Edit automation |
| `/voice` | `VoiceApp` (app) | Electron API | Mic selection, shortcuts (Electron only) |
| `/mcp` | `MCPViewerApp` (app) | — | MCP server viewer (stub) |

### Admin / Utility Routes
| Path | Component | Key Hooks | Features |
|------|-----------|-----------|----------|
| `/profile` | `ProfilePage` | useMe | Edit name, change password, sign out |
| `/settings` | `SettingsPage` | useMe, useOrganization, useTheme, useAdminAiConfig, useRbacRoles/Users | Theme, AI config, org, invites, roles, connections |
| `/admin/usage` | `UsagePage` | useAdminUsageSummary, useAdminUsageLogs | Token usage, request logs (admin only) |

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
| `app-sidebar.tsx` | `AppSidebar` | Main sidebar (see sidebar sections below) |
| `command-palette.tsx` | `CommandPalette` | Cmd+K search & navigation |
| `nav-user.tsx` | `NavUser` | User dropdown in sidebar footer (sign out, settings, profile) |
| `ObjectRegistryNavSection.tsx` | `ObjectRegistryNavSection` | Dynamic object nav items with create object button |
| `error-fallback.tsx` | `ErrorFallback` | React error boundary fallback |
| `filter-chips.tsx` | `FilterChips` | Pill-style filter buttons |
| `status-badge.tsx` | `SelectBadge`, `DealStageBadge`, `ContactStatusBadge` | Color-coded badges |
| `markdown-content.tsx` | `MarkdownContent` | Markdown renderer with prose styling |
| `nav-main.tsx` | `NavGroup` | Collapsible nav group sections (props: `{ label, items }`) |

**Sidebar Sections** (top to bottom in `app-sidebar.tsx`):
1. **Apps** — Hardcoded app nav items (Home, Chat, etc.) defined directly in `app-sidebar.tsx`. `sidebar-nav.ts` exports `SIDEBAR_NAV_APPS` config but items are hardcoded in the sidebar component.
2. **Chats** — `ChatThreadsNav` renders recent chat threads
3. **Records** — `ObjectRegistryNavSection` dynamically renders CRM objects from ObjectRegistry + "Create Object" button. This is CRM-only.
4. **Automations** — `AutomationsNav` renders automation list
5. **Footer** — `NavUser` dropdown (sign out, settings, profile)

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

## 6b. Electron / Overlay / Voice Pill

Desktop Electron integration and the voice pill overlay. These directories are only active in the Electron build. The web app (`/voice` route) shows a stub settings UI. Electron-specific code should not be imported from web components.

| Directory | Purpose |
|-----------|---------|
| `src/main/` | Electron main process: `index.ts`, `hold-key-detector`, `meeting-manager-stub`, `settings-store`, `shortcut-manager` |
| `src/overlay/` | Voice pill overlay app: `OverlayApp`, `api`, `lib/`, `meeting-recorder-stub` |
| `src/preload/` | Electron preload scripts (IPC bridge) |
| `src/renderer/` | Electron renderer entry |
| `src/shared-overlay/` | Shared overlay utilities & types |

### 6b.1 Pill Visual Design & States

| State | Height | Appearance |
|-------|--------|------------|
| Idle | 25px | Black pill, logo with breathing animation, meeting indicator if active |
| Listening | 48px+ | Mode icon + label + waveform visualizer (5 bars, RMS-driven) |
| Thinking | 48px+ | Sparkle animation + three-dot loader or streaming text (last 80 chars) |
| Transcribing | 48px+ | Three-dot loader + "Transcribing..." label |
| Response | dynamic (max ~180px) | Title + multi-line body, auto-dismiss after 5s, TTS if enabled |

- Fixed width: 400px (PILL_WIDTH), centered horizontally, y=0 (below notch)
- Framer Motion for all animations (Spring: stiffness 500, damping 35, stagger 80ms)
- Transparent frameless window, always-on-top ("screen-saver" level on macOS)

### 6b.2 Pill State Machine

States: `idle -> listening -> thinking -> response` or `idle -> listening -> transcribing -> idle`

Interaction modes: `assistant | continuous | dictation | transcribe`

Key actions: ACTIVATE, LISTENING_COMPLETE, TRANSCRIBING_START/COMPLETE, AI_STREAMING, AI_COMPLETE, AI_ERROR, COMMAND_RESULT, MEETING_UPDATE, DEACTIVATE, DISMISS

### 6b.3 File Locations

| File | Purpose |
|------|---------|
| `src/overlay/OverlayApp.tsx` | Main pill component & state machine |
| `src/overlay/lib/pill-components.tsx` | Icons, waveform, timers |
| `src/overlay/lib/pill-constants.ts` | Animation timings & dimensions |
| `src/overlay/lib/notch-pill-state.ts` | Reducer & action types |
| `src/overlay/lib/whisper.ts` | Voice capture & VAD |
| `src/overlay/lib/tts.ts` | Text-to-speech |
| `src/overlay/api.ts` | API proxy & gateway integration |
| `src/overlay/lib/use-activation-handler.ts` | Shortcut activation logic |
| `src/overlay/lib/use-ai-response.ts` | AI streaming & command detection |
| `src/overlay/lib/use-meeting-controls.ts` | Meeting recorder integration |
| `src/overlay/lib/voice-commands.ts` | Voice command patterns |

### 6b.4 Electron Window & IPC

**Window properties:** frameless, transparent, always-on-top, skip-taskbar, non-resizable, non-movable, hidden in Mission Control. Notch detection via Swift query for safe area insets.

**Mouse passthrough:** Initially ignores mouse events (click-through). On hover: enables interaction. On leave: re-enables passthrough.

**IPC channels (window.electronAPI):**
- **Listeners:** onActivate, onDeactivate, onHoldStart/End, onMeetingToggle/Started/Stopped, onSystemAudioTranscript, onNotchInfo, onBranding, onSettingsChanged, onOverlayStatusChanged
- **Invocations:** getOverlaySettings, updateOverlaySettings, getOverlayStatus, showOverlay, hideOverlay, injectText (clipboard+paste), copyToClipboard, proxyOverlayRequest (auth proxy), start/stopMeeting, getMeetingState, getPersistedMeeting, getApiUrl, getMicrophoneState
- **Broadcasts:** notifyDismissed, setIgnoreMouse, navigateMain, overlay-dismissed

### 6b.5 Keyboard Shortcuts

- `Cmd+Space` (once) -> assistant mode (listen until 3s silence)
- `Cmd+Space` (double-tap <400ms) -> continuous mode (listen indefinitely)
- `Cmd+Shift+Space` (toggle) -> dictation mode (transcribe -> inject text)
- `Cmd+Alt+Space` -> toggle meeting mode

### 6b.6 Voice Commands

Pattern matching in `voice-commands.ts`:
- `"create/add/new task: {title}"` -> create_task
- `"search/find: {query}"` -> navigate to /chat?q=...
- `"open/show: {module}"` -> navigate to /tasks, /contacts, /deals, /chat, etc.
- Unmatched -> streams to `/stream/assistant` API

### 6b.7 Audio Pipeline

- Captures via `navigator.mediaDevices.getUserMedia`
- WebM Opus codec, VAD with adaptive RMS threshold (calibration: first 500ms, threshold: avgNoise * 1.8)
- Silence timeout: 3s, min blob size: 1000 bytes
- Transcription: POST `/v1/audio/transcriptions` via proxy
- TTS: POST `/v1/audio/speech` via proxy, fallback to native speechSynthesis

### 6b.8 Settings (OverlaySettings)

- `shortcuts`: assistantToggle, dictationToggle, dictationHoldKey, meetingToggle
- `voice`: language, silenceTimeoutMs (3000), ttsEnabled, ttsRate (1.05), audioInputDeviceId
- `behavior`: doubleTapWindowMs (400), autoDismissMs (5000), showDictationPreview, holdThresholdMs (150)
- `meeting`: autoDetect, chunkIntervalMs (5000)

### 6b.9 Modification Guide

- **Pill appearance** -> `pill-components.tsx` (icons, layout), `pill-constants.ts` (dimensions, timings)
- **State transitions** -> `notch-pill-state.ts` reducer
- **Voice recognition** -> `whisper.ts` (VAD thresholds, codec, silence detection)
- **AI responses** -> `use-ai-response.ts` + `api.ts` (streaming, command detection)
- **New voice command** -> add pattern to `voice-commands.ts`
- **Shortcuts** -> `shortcut-manager.ts` (main process) + overlay settings
- **Settings UI** -> `packages/voice/VoiceApp.tsx`

### 6b.10 Screen Capture Pipeline

Electron's `desktopCapturer` API provides screen/window capture. To add screen-based features (workflow recording, screenshot annotation, visual context):

1. **Main process**: Use `desktopCapturer.getSources({ types: ['screen', 'window'] })` to enumerate sources. Expose via IPC handler (see 6b.11).
2. **Overlay process**: Request capture via `navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } } })`. Draw frames to an offscreen canvas for screenshots.
3. **Screenshot extraction**: `canvas.toDataURL('image/png')` or `canvas.toBlob()` for individual frames. For workflow recording, capture on user-action events (click, keypress) detected via OS-level event hooks or periodic polling.
4. **Storage**: Send captured data to backend via `proxyOverlayRequest` (6b.4) or save locally via Electron's `fs` in main process. Large assets (screenshots) should go to disk, not DB — store file paths in the API response.
5. **Permissions**: macOS requires Screen Recording permission in System Settings > Privacy. Electron must include `NSScreenCaptureDescription` in Info.plist. The app should detect permission status and prompt the user.

**Key files to create:**
- `src/overlay/lib/screen-capture.ts` — capture logic, frame extraction, action detection
- `src/main/screen-capture-manager.ts` — main process source enumeration, permission checks
- IPC channels: `getScreenSources`, `startScreenCapture`, `stopScreenCapture`, `captureScreenshot`

### 6b.11 Adding New IPC Channels

To extend overlay <-> main process communication:

1. **Define the channel** — Pick a descriptive name (e.g., `startScreenCapture`). Channels are strings, namespaced by convention (no formal prefix system currently).
2. **Main process handler** — In `src/main/index.ts` (or a dedicated manager file), register with `ipcMain.handle('channel-name', async (event, ...args) => { ... })` for request/response, or `ipcMain.on('channel-name', ...)` for fire-and-forget.
3. **Preload bridge** — In `src/preload/overlay.ts`, expose via `contextBridge.exposeInMainWorld('electronAPI', { ... })`. Add the method to the existing `electronAPI` object. Use `ipcRenderer.invoke('channel-name')` for async calls, `ipcRenderer.send()` for fire-and-forget, `ipcRenderer.on()` for listeners.
4. **Type safety** — Add the method signature to the `ElectronAPI` interface in `src/shared-overlay/types.ts` (or wherever the overlay types are declared). This ensures TypeScript catches missing implementations.
5. **Overlay consumption** — Call `window.electronAPI.yourMethod()` from overlay components or hooks.

**Pattern for bidirectional communication (main -> overlay):**
- Main sends: `overlayWindow.webContents.send('event-name', data)`
- Preload listens: `ipcRenderer.on('event-name', (_, data) => callback(data))`
- Expose as: `electronAPI.onEventName(callback)` with cleanup return

**Pattern for overlay -> main requests:**
- Overlay calls: `window.electronAPI.doThing(args)`
- Preload bridges: `ipcRenderer.invoke('do-thing', args)`
- Main handles: `ipcMain.handle('do-thing', async (_, args) => result)`

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

### Adding a New App Page
1. Create component in `src/components/pages/`
2. Add route in `src/App.tsx` under protected routes (NOT under `/objects/`)
3. Use `usePageHeaderTitle()` and `usePageHeaderActions()` for header integration
4. Add nav item in `app-sidebar.tsx` if needed

### Adding a New App
For standalone features that are NOT CRM record types:
1. Create page component in `src/components/pages/` (or `packages/{name}/` if complex enough for its own package)
2. Add route in `src/App.tsx` with own path (e.g., `/my-feature`) — NOT under `/objects/`
3. Add sidebar entry in `app-sidebar.tsx` (hardcoded app nav, not ObjectRegistryNavSection)
4. Use page header portals for title/breadcrumb/actions
5. Create own hooks in `src/hooks/` for data fetching — do NOT use ObjectRegistry
6. If it needs backend, add API routes in `packages/server/src/routes/`

### Adding a Pill-Integrated Feature
For features that span both the overlay pill and a management app (e.g., recording workflows, screen capture tools):

**Pill side (overlay):**
1. Add new states to `notch-pill-state.ts` reducer (e.g., `recording`) — HIGH RISK, don't restructure existing states
2. Add visual components for new states in `pill-components.tsx`
3. Add new IPC channels following the pattern in 6b.11 (preload bridge + main handler + type definition)
4. Add voice commands in `voice-commands.ts` if voice-triggered
5. Add keyboard shortcut in `shortcut-manager.ts` + overlay settings
6. For screen capture, use `desktopCapturer` pattern in 6b.10

**Management app side:**
1. Follow "Adding a New App" checklist above (page, route, sidebar, hooks, backend)
2. Create own query keys — don't reuse CRM keys

**Connecting them:**
1. Overlay saves data via `proxyOverlayRequest` → backend API
2. Overlay opens management app via `navigateMain` IPC
3. Main app refreshes after overlay actions via IPC-triggered `queryClient.invalidateQueries` (see section 10 "Overlay ↔ App Data Sharing")
4. To integrate with automations: create a new trigger or action node in `packages/automations/src/nodes/`, register in `builderConstants.NODE_TYPES`. Trigger nodes fire on events (e.g., "workflow recorded"), action nodes execute replay logic.

### Adding a New Field Type
1. Create directory `src/field-types/types/{name}/`
2. Implement `FieldTypeDefinition` with all required components
3. Register in `src/field-types/registry.ts`
4. Add UIDT mapping in `src/field-types/field-type-map.ts` if migrating from NocoDB
5. Add to type grid in `CreateAttributeModal` if user-creatable

### Adding a New CRM Object
CRM objects are DB-driven via `object_config` table. No code changes needed for basic objects. If the feature is NOT a record type (no list/detail/CRUD pattern), build an app instead (see above). Custom behavior requires:
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

---

## 9. System Data Flows

How data moves from DB → API → Hook → Component → Screen. Six critical flows traced with exact file paths and function calls.

### 9.1 Object Registry Pipeline
DB `object_config` + `schema` tables → `ObjectRegistryProvider` (`src/providers/ObjectRegistryProvider.tsx`) fetches `["object-config"]` + `["columns", tableName]` → merges via `mergeAttributes(columns, overrides, slug)` which maps `sqlType → uiType` via `mapUidtToFieldType()` and parses select options from `dtxp` → `useObject(slug)` / `useAttributes(slug)` consumed by ObjectListPage, RecordDetailPage, sidebar (ObjectRegistryNavSection), command palette, import mapper, CreateRecordModal.

### 9.2 Attribute → Every Surface
`Attribute.uiType` → `getFieldType(uiType)` (`src/field-types/registry.ts`, falls back to TextFieldType) → returns `FieldTypeDefinition` (~25 properties) → consumed by:
- **Cell.tsx** — CellDisplay / CellEditor
- **DetailField.tsx** — DetailEditor
- **RecordForm.tsx** — FormInput
- **FilterPopover.tsx** — filterOperators + conditional value inputs
- **SortPopover.tsx** — sortable fields
- **DataTable header** — icon
- **CreateAttributeModal** — TypeConfig
- **KanbanBoard** — KanbanDisplay / KanbanEditor

### 9.3 View System → DataTable
`useViews(slug)` (`src/hooks/use-views.ts`) selects active view from URL `?view=` param or default → `useViewState(viewId)` loads columns/sorts/filters from 3 queries via `useViewColumns/Sorts/Filters` → useReducer with 14 action types + `isDirtyRef` prevents server sync from overwriting local changes → ObjectListPage converts ViewSort → sortParam (fieldId → columnName lookup), ViewFilter → viewFilterParams → `useRecords(slug, {sort, viewFilters})` → DataTable receives filtered/sorted data + viewColumns for visibility/order/width.

**Save flow:** update columns → delete all server sorts/filters → recreate from local state → mark clean.

### 9.4 Record CRUD Lifecycle
- **Create:** RecordForm → useCreateRecord → POST → invalidate `["records", slug]`
- **Read:** useRecords → DataTable → Cell → CellDisplay
- **Update (cell):** CellEditor → onSave → `buildAttributeWritePayload` → useUpdateRecord (optimistic patch via onMutate queryClient.setQueryData, then invalidate on settle)
- **Split-name special case:** ObjectListPage `handleCellUpdate` checks if attribute is `first_name`/`last_name` and uses `getNameAttributes()`/`parseCombinedName()` from `src/lib/crm/display-name.ts` to split combined name into two fields
- **Update (detail):** DetailField → DetailEditor → same mutation
- **Delete:** DeleteDialog → useDeleteRecord → invalidate + remove detail cache + navigate back

### 9.5 Page Header Portal System
PageHeaderProvider (`src/contexts/page-header/`) wraps app → AppLayout registers container elements via `useRegisterActionsContainer()` / `useRegisterBreadcrumbContainer()` / `useRegisterTitleContainer()` → Page components call 9 portal hooks (usePageHeaderTitle, usePageHeaderBreadcrumb, usePageHeaderActions, usePageHeaderTabs, etc.) → returns portal node rendered in JSX → content appears in AppLayout header.

**Constraint:** must be inside PageHeaderProvider scope.

### 9.6 Cell Interaction Model
useDataTable (`src/components/data-table/useDataTable.tsx`) manages selectedCell + editingCell state:
- **Click** → select cell
- **Double-click** → enter edit mode (but: toggle-type fields like checkbox toggle value instead; primary field navigates to detail page via `navigate()`)
- **Keyboard:** arrows navigate (wrapping at row edges), Tab moves right (wraps to next row), Enter enters edit, Escape exits edit/deselects
- **Click-outside** deselects (with modal exception check)
- Cell refs (selectedCellRef, editingCellRef) prevent stale closures in event handlers

---

## 10. Dependency Map — What's Connected to What

### Object Registry drives:
Sidebar nav (ObjectRegistryNavSection), list pages (ObjectListPage), detail pages (RecordDetailPage), create modals (CreateRecordModal), import (ImportColumnMapper), command palette, field type resolution

### Attributes drive:
DataTable columns, Cell display/edit, DetailField display/edit, RecordForm fields, FilterPopover operators, SortPopover fields, CreateAttributeModal config, column header icons

### Views drive:
Column visibility/order/width in DataTable, active sorts applied to useRecords, active filters applied to useRecords, SortFilterPills display

### Field Types drive:
Cell rendering (CellDisplay), inline editing (CellEditor), form inputs (FormInput), detail sidebar editing (DetailEditor), kanban cards (KanbanDisplay/KanbanEditor), filter operators, sort comparators, value parsing/serialization, validation, display formatting

### Query Key Invalidation Chains (cascades)

| Mutation | Invalidates |
|----------|-------------|
| Contact mutations | contacts_summary, contacts, companies_summary, tasks |
| Company mutations | companies_summary, companies, contacts_summary |
| Deal mutations | deals, companies_summary |
| Task mutations | tasks, contacts_summary, contacts |
| Gateway chat finish | ALL major data keys |
| Object config changes | object-config + columns (causes ObjectRegistryProvider re-merge) |
| View mutations | view-columns/sorts/filters for that viewId → triggers useRecords refetch via ObjectListPage dependency |

### Overlay ↔ App Data Sharing

When a new feature spans both the pill/overlay and a management app (e.g., the overlay records data, the app manages it):

1. **Backend is the shared layer** — Both the overlay (via `proxyOverlayRequest`) and the web app (via `fetchApi`) hit the same `/api/*` routes. Never share state directly between overlay and main window processes.
2. **Query key coordination** — The management app uses TanStack Query with keys like `["my-feature"]`. When the overlay creates data (e.g., records a workflow), it calls the API through `proxyOverlayRequest`, then signals the main window to refetch via `navigateMain` IPC or a custom IPC channel that triggers `queryClient.invalidateQueries`.
3. **Invalidation from overlay** — The overlay has no TanStack QueryClient. To refresh the main app's cache after overlay actions: (a) send an IPC message from overlay → main process → main window renderer, (b) the renderer listens and calls `queryClient.invalidateQueries(["my-feature"])`. Follow the pattern in `useGatewayChat` which invalidates multiple keys after tool execution.
4. **Navigation from overlay** — Use `window.electronAPI.navigateMain('/my-feature/:id')` to open a specific record in the main app. The main window's router handles the navigation.

### Re-render Triggers

| Change | Affected Components |
|--------|-------------------|
| Attribute config change | Cell, DetailField, Form, Filter |
| View column show/hide | DataTable columns |
| View sort add/remove | useRecords refetch |
| Record CRUD | list/detail re-render |
| Field type definition change | app-wide re-render |

---

## 11. Translating User Requests into Code Changes

1. **"Change how the list looks"** → ObjectListPage → DataTable → useDataTable → Cell → field type CellDisplay. Column order: useViewState → updateColumn. Column width: viewColumn.width. Cell rendering: field type's CellDisplay component.

2. **"Add a new field"** → Backend: custom_field_defs table + migration. Frontend auto-discovers via ObjectRegistryProvider (no code change). But: must add ViewColumn row for existing views. RecordForm auto-includes if not isSystem/isHiddenByDefault.

3. **"Change the sidebar"** → app-sidebar.tsx (primary). ObjectRegistryNavSection for CRM objects. sidebar-nav.ts for static items. Constraints: SidebarProvider context, mobile responsive, route detection regex in AppLayout.

4. **"Change record detail page"** → RecordDetailPage → useRecordDetail (central state). Tabs: activeTab state, tab components. Fields: visibleEditableAttributes filter in useRecordDetail, RecordDetailDetailsSidebar, DetailField. Name: EditableRecordName (single vs split mode).

5. **"Add a filter type"** → Field type filterOperators array + optional FilterComponent. FilterPopover reads operators. Backend: applyFilters() in server routes must handle new operator.

6. **"Change create form"** → CreateRecordModal (dialog + validation) → RecordForm (layout + field rendering) → field type FormInput. Validation: field type validate() + form-level required check.

7. **"Add header action"** → Create action node → usePageHeaderActions(node) → render portal in JSX. Follow ObjectListPage pattern.

8. **"Change a notification/toast"** → sonner library. showError() in src/lib/show-error.ts for errors. Success toasts in mutation onSuccess callbacks.

9. **"Add a new app page"** → Create page component in `src/components/pages/`. Add route in `App.tsx` (inside AppLayout for sidebar pages, outside for standalone). Use `usePageHeaderTitle/Breadcrumb/Actions` portals to inject header content. If it needs data, add API route in `packages/server/src/routes/`, create query hook in `src/hooks/`, add query key to invalidation chains.

10. **"Add a new CRM object type"** (CRM only) → Backend: insert into `object_config` table + create DB table with migration. Frontend auto-discovers via ObjectRegistryProvider. Sidebar nav auto-populates via ObjectRegistryNavSection. List/detail pages already generic. May need: custom field types if new uiTypes, kanban support if layout toggle needed, special detail tabs. If the feature is NOT a record type, build an app instead.

10b. **"Add a new app"** → Create page in `src/components/pages/`, add route in App.tsx with own path (NOT under `/objects/`), add sidebar entry in `app-sidebar.tsx`, use page header portals. If complex enough for its own package, create in `packages/`. The CRM itself is an app — new features that aren't CRM records should be apps.

11. **"Change column behavior in the table"** → DataTable → useDataTable for interaction logic, DataTableHeader for header rendering, ColumnHeaderMenu for per-column dropdown (sort/move/rename/hide/edit field). Column resize: onMouseDown handler in DataTableHeader. Column reorder: ColumnsPopover uses @dnd-kit. Column visibility: viewState updateColumn(id, {show}).

12. **"Change the deals kanban"** → DealsKanbanBoard (`src/components/deals/DealsKanbanBoard.tsx`). Uses status field for columns. KanbanDisplay/KanbanEditor from field types. Layout toggle: localStorage `deals-layout` + URL `?layout=` param, toggled by DealsLayoutToggle in ObjectListPage header actions.

13. **"Add keyboard shortcuts"** → useDataTable for table-level shortcuts (arrows, tab, enter, escape). AppLayout for app-level shortcuts. Command palette (CommandDialogWrapper) for Cmd+K actions.

14. **"Change how a specific field type renders"** → Find field type in `src/field-types/types/{type}/`. Modify CellDisplay (list view), CellEditor (inline edit), FormInput (create/edit forms), DetailEditor (record detail sidebar). Each is independent — you can change one without affecting others. But parseValue/serializeValue affect ALL surfaces.

15. **"Modify view persistence (sorts/filters/columns)"** → useViewState reducer in `src/hooks/use-views.ts` (14 action types). View CRUD hooks in `src/hooks/use-view-queries.ts`. Save flow is multi-step: columns → delete sorts → recreate sorts → delete filters → recreate filters. Virtual columns (prefix `virtual-*`) get created server-side before save.

---

## 12. Dangerous Changes — Risk Assessment

### CRITICAL RISK (affects entire app)
- **Field type parseValue/serializeValue** → breaks all records of that type across list, detail, form, kanban
- **Attribute interface** (`src/types/objects.ts`) → breaks every component that reads attributes
- **ObjectRegistryProvider merge logic** → breaks all object discovery
- **Query key format changes** → breaks all invalidation (stale data everywhere)
- **GatewayProvider API key/token flow** → breaks all AI features (chat, voice, automations with AI nodes)
- **useMe/auth flow** → breaks all authenticated access
- **fetchApi wrapper** → breaks ALL data fetching app-wide

### HIGH RISK (affects major feature area)
- **ObjectListPage data flow** → breaks all list views
- **useViewState reducer** → breaks view persistence (columns, sorts, filters)
- **useUpdateRecord optimistic update** → breaks inline editing + data consistency
- **API contract** (buildAttributeWritePayload, normalizeFilterOperator) → silent data corruption
- **Split-name logic** (getNameAttributes/parseCombinedName in display-name.ts) → breaks name display/edit for contacts
- **Cell interaction model** (useDataTable click/keyboard handlers) → breaks all inline editing across every list view
- **useGatewayChat tool execution** → breaks AI chat tool results + cache invalidation
- **AutomationBuilderProvider** → breaks automation canvas
- **notch-pill-state.ts reducer** → breaks all pill interactions (states, transitions, modes)
- **proxyOverlayRequest auth flow** → breaks voice API access from overlay

### MEDIUM RISK (affects single page/component)
- **useRecordDetail hook** → breaks record detail page (all tabs, name editing, field editing, prev/next nav)
- **Sidebar structure** → affects navigation + recent pages tracking
- **FilterPopover logic** → wrong query results
- **EditableRecordName** → breaks name editing in detail page (heading + field variants, single + split modes)
- **DealsKanbanBoard** → breaks kanban view for deals
- **ColumnsPopover / dnd-kit reorder** → breaks column management
- **ChatPage/ai-elements** → breaks chat UI only
- **SettingsPage sections** → breaks specific admin features
- **ImportWizard state machine** → breaks import flow
- **command-palette.tsx** → breaks Cmd+K search
- **whisper.ts VAD thresholds** → affects voice recognition quality (silence detection, noise calibration)

### LOW RISK (isolated)
- Individual page components (ProfilePage, SettingsPage sections)
- Toast messages
- Skeleton/loading states
- Individual detail tabs (NotesTabContent — contacts+deals only)
- HomePage sections — cosmetic dashboard changes
- VoiceApp settings UI — Electron-only feature
- MCPViewerApp — stub
- UsagePage — isolated admin analytics
- Individual automation nodes — isolated to that node type
- pill-components.tsx visual changes — isolated to pill UI appearance

---

## 13. Change Checklists

### Checklist: Changed a field type
- [ ] CellDisplay renders correctly in DataTable
- [ ] CellEditor works (enter edit, save, cancel)
- [ ] FormInput works in CreateRecordModal
- [ ] DetailEditor works in record detail sidebar
- [ ] KanbanDisplay renders in deals kanban (if applicable)
- [ ] filterOperators still valid (FilterPopover)
- [ ] parseValue handles existing DB data (null, empty, legacy formats)
- [ ] serializeValue produces valid API payload
- [ ] validate() catches invalid input
- [ ] comparator sorts correctly
- [ ] TypeConfig still renders (if hasTypeConfig)

### Checklist: Changed an attribute or added a field
- [ ] ObjectRegistryProvider picks it up (check /api/schema response)
- [ ] DataTable shows new column (check ViewColumn exists with show:true)
- [ ] RecordForm includes it (check isSystem/isHiddenByDefault flags)
- [ ] DetailField renders in record detail sidebar
- [ ] Existing records display correctly (parseValue handles null/empty)
- [ ] Filter by this field works (filterOperators defined)
- [ ] Sort by this field works (comparator defined)

### Checklist: Changed a hook's query key
- [ ] All invalidation sites updated (grep for old key pattern)
- [ ] Optimistic updates reference correct key
- [ ] No stale data in any view (list, detail, related objects)
- [ ] Cross-invalidation chains still work (e.g., contact change → companies_summary)

### Checklist: Changed ObjectListPage
- [ ] All object types still render (contacts, companies, deals, tasks, custom)
- [ ] Kanban toggle still works for deals
- [ ] Sort/filter pills display correctly
- [ ] View tabs work (create, rename, delete, switch)
- [ ] Pagination works
- [ ] Cell inline editing works
- [ ] Column resize/reorder works
- [ ] Create record modal opens and submits
- [ ] Delete confirmation works

### Checklist: Changed RecordDetailPage
- [ ] All tabs render (Overview, Activity, Notes, Tasks)
- [ ] Name editing works (single and split modes)
- [ ] Field editing works in sidebar (all field types)
- [ ] Show/hide empty fields toggle works
- [ ] Prev/next navigation works
- [ ] Favorite/duplicate/delete actions work
- [ ] Breadcrumb shows correct path
- [ ] Notes tab CRUD works

### Checklist: Added a new app page
- [ ] Route added in App.tsx (correct layout wrapper, NOT under `/objects/`)
- [ ] Page header portals used (title, breadcrumb, actions)
- [ ] Sidebar nav entry added in `app-sidebar.tsx` if user-facing (hardcoded app nav — NOT ObjectRegistryNavSection, which is CRM objects only)
- [ ] Mobile responsive (useIsMobile check if layout differs)
- [ ] Loading/error states handled
- [ ] Auth-protected if needed (route guard or API session check)

### Checklist: Changed sidebar
- [ ] Desktop and mobile layouts both work (SidebarProvider responsive)
- [ ] Traffic light clearance maintained on macOS Electron (52px)
- [ ] Route detection regex in AppLayout still matches new routes
- [ ] Recent pages tracking still works (useRecentPages)
- [ ] Collapsed sidebar state works correctly

### Checklist: Changed view system (sorts/filters/columns)
- [ ] isDirtyRef mechanism still prevents server sync overwriting local changes
- [ ] Virtual column creation still works (virtual-* prefix → createColumnMutation)
- [ ] Save flow completes all steps (columns → sorts → filters → mark clean)
- [ ] Discard resets to server snapshot correctly
- [ ] SortFilterPills display matches actual active sorts/filters
- [ ] Sort/filter conversion to API params works (fieldId → columnName lookup)

---

## 14. Apps — Complete Coverage

### 14.1 Chat App
**Files:** `src/components/pages/ChatPage.tsx`, `src/hooks/useGatewayChat.ts`, `src/hooks/use-threads.ts`, `src/components/ai-elements/` (prompt-input, conversation, message, attachments, shimmer, suggestion)

**Data flow:** ChatPage → useGatewayChat (wraps @ai-sdk/react useChat) → POST `/api/gateway-chat` → server executes tools (search_contacts, create_contact, etc.) → streams response → X-Thread-Id header → thread persistence via `/api/threads`

**Query keys:** `["threads", limit]`, `["thread-messages", threadId]`. On tool execution finish: invalidates `contacts_summary`, `deals`, `companies_summary`, `tasks`, `contact_notes`, `threads`

**Dependencies:** GatewayProvider (API key validation), useMe (auth), thread storage backend

**Modification guide:** Chat UI → ai-elements components. Tool execution → `packages/server/src/routes/gateway-chat/tools.ts`. System prompt → `protocol.ts`. Thread persistence → `storage.ts`. Adding a new tool: define in tools.ts, implement executeValidatedTool, add invalidation for affected query keys.

### 14.2 Automations App
**Files:** `packages/automations/` — AutomationsApp.tsx (router), AutomationListPage.tsx, AutomationBuilderPage.tsx, AutomationBuilderProvider.tsx, NodeConfigPanel.tsx, VariablePicker.tsx, EntityPicker.tsx, WorkflowPropertiesSheet.tsx, AutomationRunsPanel.tsx

**Node types:** Triggers (TriggerEventNode, TriggerScheduleNode, BlankTriggerNode), Actions (AIActionNode, AIAgentNode, CrmActionNode, EmailActionNode, SlackActionNode, GmailReadNode, GmailSendNode, WebSearchActionNode, BlankActionNode)

**Data model:** AutomationRule with workflowDefinition (nodes + edges). Topological sort for execution order. Variables: `{{trigger_data}}`, `{{ai_result}}`, etc.

**Backend:** `/api/automation_rules` (CRUD), `/api/automation-runs/run` (execute), `/api/automation-runs?ruleId=X` (history)

**Modification guide:** New node type → create in `packages/automations/src/nodes/`, register in builderConstants.NODE_TYPES, implement config panel. New variable → add to VariablePicker resolution. Canvas → uses React Flow (xylflow). Execution → server-side with status tracking.

### 14.3 Home App
**Files:** `src/components/pages/HomePage.tsx`, `src/components/home-sections.tsx`

**Sections:** RecentRecordsSection (recently viewed contacts/companies/deals), RecentsSection (activity feed — agent_chat, automation_success/error, record_created/updated), RecentChatsSection (thread history with titles)

**Features:** Time-of-day greeting, recent chat pill (links to last thread), quick chat input (creates new thread via POST)

**Dependencies:** useRecentItems, useThreads, useGatewayChat

**Modification guide:** Add section → define in HOME_SECTIONS array in home-sections.tsx. Quick chat → same flow as ChatPage.

### 14.4 Settings App
**Files:** `src/components/pages/SettingsPage.tsx`

**Sections:** Theme (light/dark/system via next-themes), Organization (name/logo via useOrganization), AI Configuration (BYOK vs managed, provider selection — admin only, uses useAdminAiConfig/useSaveAdminAiConfig), Transcription BYOK (Deepgram key — admin only), Connections (ConnectionsContent — Gmail/Slack OAuth), Team Members (useRbacUsers/useAssignRbacRole — admin only), Invites (signup link generation with Electron clipboard support — admin only)

**Query keys:** `["organization"]`, `["admin", "ai-config"]`, `["rbac_users"]`, `["rbac_roles"]`, `["me"]`

**Modification guide:** Add section → add to SettingsPage JSX. Admin-only → gate with `me?.administrator`. Connection provider → add to ConnectionsContent + backend `/api/connections`.

### 14.5 Import App
**Files:** `src/components/import/` — ImportWizard.tsx (coordinator), ImportFileDropzone.tsx, ImportObjectSelector.tsx, ImportColumnMapper.tsx, ImportMergeOptions.tsx, ImportPreviewTable.tsx, ImportProgress.tsx, import-utils.ts. Hooks: `src/hooks/use-import.ts` (state machine), `src/hooks/use-import-execute.ts` (batch execution)

**Steps:** file → map → merge → preview → execute

**Features:** CSV parsing, dynamic column mapping to attributes, custom field creation mid-import, merge key selection, conflict behavior (skip/overwrite), batch creation (25 records per batch), progress tracking

**Dependencies:** ObjectRegistryProvider (for attribute mapping), useCreateRecord

**Modification guide:** New import format → modify import-utils.ts parser. New step → add to step state machine in use-import.ts. Execution logic → use-import-execute.ts.

### 14.6 Tasks App
**Files:** `src/components/pages/TasksPage.tsx`

**Features:** Time-based bucketing (Overdue, Today, Tomorrow, ThisWeek, Later), contact association, type selection, ContactSheet slide-out for quick contact view

**Dependencies:** useRecords for tasks, ContactSheet component

**Query keys:** `["records", "tasks", ...]`

### 14.7 Notes App
**Files:** `src/components/pages/NotesPage.tsx`

**Features:** Tabbed view (Deal Notes, Contact Notes), pagination, navigation to parent records

**Dependencies:** useRecords for contact_notes/deal_notes

### 14.8 Command Palette App
**Files:** `src/components/command-palette.tsx`

**Shortcut:** Cmd/Ctrl+K

**Search:** Static nav items, dynamic object navigation (ObjectRegistry), live contact/company/deal search (≥2 chars via getList), recent items, dynamic "Create {Object}" commands

**Dependencies:** useObjects (ObjectRegistry), getList from api/crm, useRecentItems

**Modification guide:** Add command → add to static items or dynamic groups in command-palette.tsx. Event dispatch: `OPEN_COMMAND_PALETTE_EVENT`.

### 14.9 Voice App
**Files:** `packages/voice/VoiceApp.tsx`

**Features:** Microphone device selector, keyboard shortcuts display (Cmd+Space for AI, double-tap for continuous, Cmd+Shift+Space for dictation), overlay visibility toggle

**Electron-only:** window.electronAPI.getOverlayStatus/showOverlay/hideOverlay/getOverlaySettings/updateOverlaySettings

**Backend:** `/api/voice-proxy` proxies to gateway voice service

### 14.10 MCP Viewer App
**Files:** `packages/mcp-viewer/MCPViewerApp.tsx`

**Status:** Stub/placeholder for custom MCP server integration

### 14.11 Hub Utility Package
**Files:** `packages/hub/` — routes.ts exports ROUTES constant

**Purpose:** Centralized route management for cross-package imports

### 14.12 Connections/OAuth App
**Files:** `src/components/connections/ConnectionsContent.tsx`

**Providers:** Gmail (Google OAuth), Slack

**Flow:** Click Connect → GET `/api/connections/{provider}/authorize` (OAuth redirect) → callback → GET `/api/connections` (list). Disconnect → DELETE `/api/connections/{provider}`

**Modification guide:** New provider → add to ConnectionsContent + backend routes/connections.ts

### 14.13 Profile App
**Files:** `src/components/pages/ProfilePage.tsx`

**Features:** Name editing, password change

**Dependencies:** useMe, authClient

### 14.14 Usage/Admin App
**Files:** `src/components/pages/UsagePage.tsx`

**Features:** Per-user and per-feature usage analytics with day-range selector

**Query keys:** `["admin", "usage", "logs", days]`, `["admin", "usage", "summary", days]`

**Admin-only:** Yes

---

## 15. Additional Query Keys & Hooks (App-Level)

| Hook | Query Key | Invalidated By |
|------|-----------|----------------|
| useMe | `["me"]` | Admin AI config save, auth changes |
| useOrganization | `["organization"]` | Org settings update |
| useAdminAiConfig | `["admin", "ai-config"]` | AI config save/clear |
| useAdminUsageLogs | `["admin", "usage", "logs", days]` | — (read-only) |
| useAdminUsageSummary | `["admin", "usage", "summary", days]` | — (read-only) |
| useRbacRoles | `["rbac_roles"]` | — (read-only) |
| useRbacUsers | `["rbac_users"]` | Role assignment |
| useFavorites | `["favorites", objectSlug]` | Toggle favorite |
| useFavorites (all) | `["favorites", "all"]` | Toggle favorite |
| useThreads | `["threads", limit]` | Chat completion, new thread |
| useThreadMessages | `["thread-messages", threadId]` | — (read-only) |
| useTableColumns | `["columns", resource]` | Column create/update/delete |
| useGridPreferences | localStorage `grid-prefs-{resource}` | Local state only |
| useRecentItems | localStorage `crm:recent` | Local state only |
| useRecentPages | localStorage `crm:recent-pages` | Local state only |

---

## 16. Expanded User Request Translations (Apps)

16. **"Change the chat/AI"** → ChatPage.tsx for UI, ai-elements/ for message/prompt components, useGatewayChat for client-side chat hook, gateway-chat.ts (server) for tool execution, protocol.ts for system prompt, tools.ts for available tools

17. **"Add an automation node"** → Create node component in packages/automations/src/nodes/, register in builderConstants, implement config in NodeConfigPanel, add variable bindings to VariablePicker

18. **"Change settings"** → SettingsPage.tsx has all sections. Admin sections gated by me?.administrator. Each section has its own query hook (useOrganization, useAdminAiConfig, useRbacUsers, etc.)

19. **"Change the home/dashboard"** → HomePage.tsx + home-sections.tsx. Sections configured in HOME_SECTIONS array. Add/remove/reorder sections there.

20. **"Add a command palette action"** → command-palette.tsx. Static items in array, dynamic items from ObjectRegistry + live search queries.

21. **"Change the import flow"** → ImportWizard.tsx orchestrates steps. Each step is a separate component. State machine in use-import.ts. Execution in use-import-execute.ts.

22. **"Add an OAuth connection"** → ConnectionsContent.tsx for frontend, routes/connections.ts for backend OAuth flow, add provider to providers array.

23. **"Change voice/overlay settings"** → packages/voice/VoiceApp.tsx for settings UI. Electron-only via window.electronAPI. Backend proxy at voice-proxy.ts.

24. **"Change the pill/overlay"** → `src/overlay/OverlayApp.tsx` for layout, `pill-components.tsx` for visuals, `notch-pill-state.ts` for state machine, `pill-constants.ts` for dimensions/timings. See section 6b for full architecture.

25. **"Add a voice command"** → `voice-commands.ts` pattern array, implement handler, add navigation via `navigateMain` IPC.

26. **"Change voice recognition"** → `whisper.ts` for VAD, codec, silence detection. Settings in `shared-overlay/types.ts`.

27. **"Add a new app"** → Create page in `src/components/pages/`, add route in App.tsx with own path (NOT under `/objects/`), add sidebar entry in `app-sidebar.tsx`, use page header portals. If complex enough for its own package, create in `packages/`. The CRM itself is an app — new features that aren't CRM records should be apps.

28. **"Build a pill-integrated feature"** (e.g., workflow recorder, screen capture tool) → Follow section 8 "Adding a Pill-Integrated Feature". Pill states in `notch-pill-state.ts`, visuals in `pill-components.tsx`, new IPC channels per 6b.11, screen capture per 6b.10, management app per "Adding a New App", data sharing per section 10 "Overlay ↔ App Data Sharing", automation integration via new node type in `packages/automations/src/nodes/`.

29. **"Add screen capture to the overlay"** → `desktopCapturer` in main process (6b.10), IPC bridge (6b.11), overlay hook in `src/overlay/lib/`, store screenshots via `proxyOverlayRequest` → backend API. macOS requires Screen Recording permission.

---

## 17. Expanded Risk Assessment (Apps)

**CRITICAL RISK:**
- GatewayProvider API key/token flow → breaks all AI features (chat, voice, automations with AI nodes)
- useMe/auth flow → breaks all authenticated access
- fetchApi wrapper → breaks ALL data fetching app-wide

**HIGH RISK:**
- useGatewayChat tool execution → breaks AI chat tool results + cache invalidation
- AutomationBuilderProvider → breaks automation canvas
- ObjectRegistryProvider → breaks command palette, sidebar, import mapper (in addition to CRM)
- notch-pill-state.ts reducer → breaks all pill interactions
- proxyOverlayRequest auth flow → breaks voice API access from overlay

**MEDIUM RISK:**
- ChatPage/ai-elements → breaks chat UI only
- SettingsPage sections → breaks specific admin features
- ImportWizard state machine → breaks import flow
- command-palette.tsx → breaks Cmd+K search
- whisper.ts VAD thresholds → affects voice recognition quality

**LOW RISK:**
- HomePage sections → cosmetic dashboard changes
- VoiceApp settings UI → Electron-only feature
- MCPViewerApp → stub
- ProfilePage → isolated user profile
- UsagePage → isolated admin analytics
- Individual automation nodes → isolated to that node type
- pill-components.tsx visual changes → isolated to pill UI

---

## 18. Additional Checklists

### Checklist: Changed AI Chat
- [ ] Chat messages render correctly (message.tsx)
- [ ] Streaming responses work (useGatewayChat → useChat)
- [ ] Tool execution produces correct results (tools.ts)
- [ ] Thread persistence works (threads created, messages saved)
- [ ] Query invalidation after tool use works (contacts, deals, etc.)
- [ ] Attachments display correctly
- [ ] Suggestions render and navigate correctly
- [ ] Chat from HomePage quick input works

### Checklist: Changed Automations
- [ ] Automation list renders with enable/disable toggle
- [ ] Builder canvas renders nodes and edges
- [ ] Node config panel opens and saves
- [ ] Variable picker resolves variables correctly
- [ ] Topological sort produces correct execution order
- [ ] Manual run executes and shows results
- [ ] Run history displays in AutomationRunsPanel

### Checklist: Changed Settings
- [ ] All sections render (Theme, Org, AI Config, Transcription, Connections, Team, Invites)
- [ ] Admin-only sections hidden for non-admins
- [ ] AI config save/clear works (invalidates ["me"], ["admin", "ai-config"])
- [ ] Connection OAuth flow works (authorize → callback → display)
- [ ] Role assignment works and prevents removing last RBAC manager
- [ ] Invite link generation and clipboard copy works (including Electron)

### Checklist: Changed Import
- [ ] All wizard steps navigate correctly (file → map → merge → preview → execute)
- [ ] CSV parsing handles headers and edge cases
- [ ] Column mapper shows all attributes from ObjectRegistry
- [ ] Custom field creation mid-import works
- [ ] Merge key and conflict behavior selection works
- [ ] Preview table shows transformed data correctly
- [ ] Batch execution completes with progress tracking
- [ ] Error reporting shows failed records

### Checklist: Changed Command Palette
- [ ] Cmd/Ctrl+K opens palette
- [ ] Static nav items all navigate correctly
- [ ] Dynamic object items from ObjectRegistry appear
- [ ] Live search returns contacts/companies/deals (≥2 chars)
- [ ] Recent items display when palette opened empty
- [ ] "Create {Object}" commands work

### Checklist: Changed Voice Pill
- [ ] All 5 states render correctly (idle, listening, thinking, transcribing, response)
- [ ] Keyboard shortcuts activate correct modes (assistant, continuous, dictation, meeting)
- [ ] Waveform visualizer responds to audio levels
- [ ] Voice commands detected and executed
- [ ] Transcription -> text injection works (clipboard + paste)
- [ ] AI streaming responses display and auto-dismiss
- [ ] TTS plays (and fallback to native works)
- [ ] Mouse passthrough works (click-through when not hovering)
- [ ] Meeting mode indicator shows timer
- [ ] Settings changes propagate (mic device, shortcuts, TTS toggle)
- [ ] Notch detection positions pill correctly
