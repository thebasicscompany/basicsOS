---
name: frontend-dev
description: Coding practices for frontend development in Basics CRM. Use when creating or modifying React components, list pages, detail views, forms, data fetching, field types, or responsive layouts.
---

The frontend uses React 19, TanStack Query, React Router v7, and Shadcn UI. Data flows from the Hono REST API (`/api/*`) via custom hooks. There is no React Admin.

## Architecture

- **Object Registry**: Objects (contacts, companies, deals, tasks, etc.) are configured via DB. `ObjectRegistryProvider` wraps the app. Use `useObject(slug)`, `useAttributes(slug)`, `useObjects()` from `@/hooks/use-object-registry`.
- **Generic list/detail**: `ObjectListPage` and `RecordDetailPage` serve `/objects/:objectSlug` and `/objects/:objectSlug/:recordId`. They are driven by the object registry and attributes.
- **Views (NocoDB-style)**: Sorts, filters, and column config are persisted via `/api/views/*`. Use `useViews(objectSlug)` and `useViewState` from `@/hooks/use-views`.

## Data fetching

- **Records**: `useRecords(objectSlug, params)`, `useRecord(objectSlug, recordId)` from `@/hooks/use-records`.
- **Mutations**: `useCreateRecord`, `useUpdateRecord`, `useDeleteRecord` from `@/hooks/use-records`. All use TanStack Query (`useMutation`) and call `@/lib/api/crm`.
- **Other API**: Use `fetchApi` from `@/lib/api` or `useQuery`/`useMutation` with custom query functions.

## UI components

- **Shadcn UI**: Import from `@/components/ui/` (Button, Card, Dialog, Sheet, etc.).
- **Field types**: Each attribute has a `uiType` mapping to a field type. Use `getFieldType(uiType)` from `@/field-types`. Field types provide `CellDisplay`, `CellEditor`, `FormInput`, and optional `TypeConfig` for admin UI.
- **Forms**: `RecordForm` renders a dynamic form from an `Attribute[]` and `values`/`onChange`. Used by `CreateRecordModal` and record detail inline edit.

## Conventions

- **Paths**: `@/` → `src/`. Use `basics-os/src` for packages importing from the main app.
- **Data table**: `DataTable` + `useDataTable` for list views. Supports pagination, sorting, column resize, and view persistence.
- **Responsive**: Use `useIsMobile()` (or similar) when branching layouts. Deals have a kanban toggle via `DealsLayoutToggle`.
- **Auth**: Session-based via Better Auth. Use `authClient` from `@/lib/auth-client` for sign-in/sign-out/session checks.

For complete UI architecture reference (all pages, components, hooks, field types, interactions): see UI-REFERENCE.md in this directory.
