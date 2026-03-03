# API endpoints – object list / views flow

Use this to see what the frontend calls when you open Companies, People, or Deals, and to debug responses.

**Base URL:** `VITE_API_URL` from env, or same-origin (e.g. `http://localhost:3001` when using dev server).

**Auth:** All requests use `credentials: "include"` (cookies). Call these from the same origin after logging in, or send the session cookie if using curl/Postman.

---

## 1. Object config (sidebar + object registry)

| Frontend | Method | URL | Response |
|----------|--------|-----|----------|
| `ObjectRegistryProvider` | GET | `/api/object-config` | `ObjectConfigApiResponse[]` (each has `id`, `slug`, `singularName`, `pluralName`, `icon`, `iconColor`, **`tableName`**, `type`, `isActive`, `position`, `settings`, `attributes`) |

**Check:** Response should include `tableName` (not `nocoTableName`). Each object has `attributes` (overrides from DB).

---

## 2. Schema (columns per object)

| Frontend | Method | URL | Response |
|----------|--------|-----|----------|
| `ObjectRegistryProvider` (per active object) | GET | `/api/schema/:tableName` | `{ columns: NocoDBColumn[] }` |

**Example:** `/api/schema/companies` → columns for the companies table (from `object_config.table_name`).

**Check:** `tableName` must be one of the allowed tables (e.g. `companies`, `contacts`, `deals`). Each column has `id` (usually `column_name`), `column_name`, `uidt`, etc.

---

## 3. Views (list + default view creation)

| Frontend | Method | URL | Response |
|----------|--------|-----|----------|
| `useNocoViews(objectSlug)` | GET | `/api/views/:objectSlug` | `{ list: NocoViewRaw[] }` |

**Example:** `/api/views/companies` → list of views for Companies. If the list is empty, the **backend creates a default “Grid View” and seeds its view_columns** from the object’s table schema, then returns that one view.

**Check:** You should get at least one view with `id`, `title`, `type`, `is_default`, etc. After the recent fix, the default view should already have columns in the DB.

---

## 4. View columns (what the grid shows)

| Frontend | Method | URL | Response |
|----------|--------|-----|----------|
| `useNocoViewColumns(viewId)` | GET | `/api/views/view/:viewId/columns` | `{ list: NocoViewColumnRaw[] }` |

**Example:** `/api/views/view/<view-uuid>/columns` → list of column configs for that view. Each item: `id`, `fk_column_id` (fieldId, e.g. column name), `title`, `show`, `order`, `width`.

**Check:** If you see “Columns 0”, this list is empty. After the backend fix, the default view should return a non‑empty `list` (one entry per table column).

---

## 5. View sorts / filters (optional)

| Frontend | Method | URL | Response |
|----------|--------|-----|----------|
| `useNocoViewSorts(viewId)` | GET | `/api/views/view/:viewId/sorts` | `{ list: NocoViewSortRaw[] }` |
| `useNocoViewFilters(viewId)` | GET | `/api/views/view/:viewId/filters` | `{ list: NocoViewFilterRaw[] }` |

Usually empty for a new view.

---

## 6. Records (list data for the table)

| Frontend | Method | URL | Response |
|----------|--------|-----|----------|
| `useRecords(objectSlug)` → `getList(resource, params)` | GET | `/api/:resource?range=[start,end]&sort=...&order=...&filters=...` | JSON array + `Content-Range: resource start-end/total` |

**Example:** `/api/companies?range=[0,24]` → first 25 companies. `resource` is the **object slug** (e.g. `companies`, `contacts`, `deals`), which must match a CRM resource.

**Check:** Response body is an array of rows; total comes from `Content-Range` and is used for “8 total” etc.

---

## Quick debug order

1. **GET /api/object-config** – objects have `tableName`, slugs are `companies` / `contacts` / `deals`.
2. **GET /api/views/companies** – you get at least one view; note its `id`.
3. **GET /api/views/view/<that-id>/columns** – should be non‑empty (names like `name`, `sector`, `id`, …).
4. **GET /api/schema/companies** – columns for the object (used for attribute metadata).
5. **GET /api/companies?range=[0,24]** – actual record rows.

If step 3 returns an empty `list`, the grid will show “Columns 0” and no data columns; the backend change seeds default view_columns when creating (or backfilling) the default view so step 3 returns data.
