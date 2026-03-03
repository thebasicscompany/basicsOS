Response:
       I now have a complete picture of the codebase. Let me produce the detailed implementation plan.

       ---
       Implementation Plan: Remove NocoDB, Wire Directly to Hono + Postgres

       Overview of what gets replaced

       NocoDB currently serves three roles:
       1. Data CRUD layer (all record list/get/create/update/delete operations)
       2. Column introspection (schema discovery for the ObjectRegistry)
       3. View persistence (views, view_columns, view_sorts, view_filters as NocoDB-owned metadata)

       The backend Hono server already handles CRUD. The plan adds two missing pieces to the Hono server: schema
       introspection and view persistence. Then the frontend adapters are rewritten to call Hono instead of NocoDB.        

       The implementation is broken into five phases. Each phase is independently testable and does not break the
       running app at the phase boundary.

       ---
       Phase 1: Database — New Schema Tables and Drizzle Schema

       1A. New Postgres Tables

       Create a single Drizzle migration file: packages/server/drizzle/<timestamp>_add_views_schema.sql (generated via     
        pnpm drizzle-kit generate after writing the Drizzle schema files below).

       Table: views

       CREATE TABLE views (
           id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
           object_slug VARCHAR(64)  NOT NULL,
           sales_id    BIGINT       NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
           title       VARCHAR(255) NOT NULL,
           type        VARCHAR(32)  NOT NULL DEFAULT 'grid',  -- 'grid'|'kanban'|'gallery'|'form'
           display_order SMALLINT   NOT NULL DEFAULT 0,
           is_default  BOOLEAN      NOT NULL DEFAULT false,
           lock_type   VARCHAR(32),                            -- 'collaborative'|'locked'|'personal'
           created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
       );
       CREATE INDEX views_slug_sales ON views(object_slug, sales_id);

       Why TEXT primary key? NocoDB returns id as a string like md_xxxxxxxx. The ViewConfig.id type in
       src/types/views.ts is string. Using UUID-as-text means zero changes to the TypeScript types and the existing        
       id: raw.id mapper lines in use-noco-views.ts.

       Table: view_columns

       CREATE TABLE view_columns (
           id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
           view_id     TEXT        NOT NULL REFERENCES views(id) ON DELETE CASCADE,
           field_id    VARCHAR(128) NOT NULL,  -- column_name from information_schema
           title       VARCHAR(255),
           show        BOOLEAN      NOT NULL DEFAULT true,
           display_order SMALLINT   NOT NULL DEFAULT 0,
           width       VARCHAR(32),
           UNIQUE(view_id, field_id)
       );

       Table: view_sorts

       CREATE TABLE view_sorts (
           id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
           view_id     TEXT        NOT NULL REFERENCES views(id) ON DELETE CASCADE,
           field_id    VARCHAR(128) NOT NULL,
           direction   VARCHAR(4)   NOT NULL DEFAULT 'asc',  -- 'asc'|'desc'
           display_order SMALLINT   NOT NULL DEFAULT 0
       );

       Table: view_filters

       CREATE TABLE view_filters (
           id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
           view_id      TEXT        NOT NULL REFERENCES views(id) ON DELETE CASCADE,
           field_id     VARCHAR(128) NOT NULL,
           comparison_op VARCHAR(32)  NOT NULL,
           value        TEXT,
           logical_op   VARCHAR(8)   NOT NULL DEFAULT 'and'
       );

       1B. Drizzle Schema Files

       Create packages/server/src/db/schema/views.ts:

       import { pgTable, text, varchar, boolean, smallint, timestamp, bigint, unique } from "drizzle-orm/pg-core";
       import { sql } from "drizzle-orm";
       import { sales } from "./sales.js";

       export const views = pgTable("views", {
         id:           text("id").primaryKey().default(sql`gen_random_uuid()::text`),
         objectSlug:   varchar("object_slug", { length: 64 }).notNull(),
         salesId:      bigint("sales_id", { mode: "number" }).notNull().references(() => sales.id, { onDelete:
       "cascade" }),
         title:        varchar("title", { length: 255 }).notNull(),
         type:         varchar("type", { length: 32 }).notNull().default("grid"),
         displayOrder: smallint("display_order").notNull().default(0),
         isDefault:    boolean("is_default").notNull().default(false),
         lockType:     varchar("lock_type", { length: 32 }),
         createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
       });

       export const viewColumns = pgTable("view_columns", {
         id:           text("id").primaryKey().default(sql`gen_random_uuid()::text`),
         viewId:       text("view_id").notNull().references(() => views.id, { onDelete: "cascade" }),
         fieldId:      varchar("field_id", { length: 128 }).notNull(),
         title:        varchar("title", { length: 255 }),
         show:         boolean("show").notNull().default(true),
         displayOrder: smallint("display_order").notNull().default(0),
         width:        varchar("width", { length: 32 }),
       }, (t) => [unique().on(t.viewId, t.fieldId)]);

       export const viewSorts = pgTable("view_sorts", {
         id:           text("id").primaryKey().default(sql`gen_random_uuid()::text`),
         viewId:       text("view_id").notNull().references(() => views.id, { onDelete: "cascade" }),
         fieldId:      varchar("field_id", { length: 128 }).notNull(),
         direction:    varchar("direction", { length: 4 }).notNull().default("asc"),
         displayOrder: smallint("display_order").notNull().default(0),
       });

       export const viewFilters = pgTable("view_filters", {
         id:           text("id").primaryKey().default(sql`gen_random_uuid()::text`),
         viewId:       text("view_id").notNull().references(() => views.id, { onDelete: "cascade" }),
         fieldId:      varchar("field_id", { length: 128 }).notNull(),
         comparisonOp: varchar("comparison_op", { length: 32 }).notNull(),
         value:        text("value"),
         logicalOp:    varchar("logical_op", { length: 8 }).notNull().default("and"),
       });

       Add export * from "./views.js"; to packages/server/src/db/schema/index.ts.

       Run pnpm drizzle-kit generate then pnpm drizzle-kit migrate (or pnpm db:push for dev).

       ---
       Phase 2: Backend — New Hono Routes

       2A. Schema Introspection Route

       Create packages/server/src/routes/schema.ts.

       Purpose: Replace GET /api/v2/meta/tables/{tableId} from NocoDB.

       Endpoint: GET /api/schema/:tableName

       Request: Authenticated. tableName is a Postgres table name (e.g. contacts, companies, contacts_summary).

       Response shape (mirrors what ObjectRegistryProvider needs to build NocoDBColumn[]):
       {
         "columns": [
           {
             "id": "first_name",
             "fk_model_id": "contacts",
             "title": "First Name",
             "column_name": "first_name",
             "uidt": "SingleLineText",
             "dt": "varchar",
             "pk": false,
             "pv": false,
             "rqd": false,
             "un": false,
             "ai": false,
             "unique": false,
             "cdf": null,
             "dtxp": "",
             "order": 1,
             "system": false,
             "meta": null
           }
         ]
       }

       Key implementation points:
       - Query information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position      
       - Map Postgres data_type to NocoDB uidt string using a lookup table (below). This preserves full compatibility      
       with the existing NOCODB_UIDT_TO_FIELD_TYPE map in ObjectRegistryProvider.tsx without changing it.
       - For the summary virtual tables (contacts_summary, companies_summary), the columns come from their base tables     
        plus the computed aggregation fields. Handle these with a known static column list or by querying both base        
       table and joining in the computed column names manually.
       - system = true for columns: id, created_at, updated_at, sales_id, organization_id
       - pv (primary value / display field) = use the override from object_attribute_overrides.is_primary if it
       exists, otherwise default to the first non-system, non-id varchar column
       - pk = true for id column

       Postgres type to NocoDB uidt mapping (server-side):
       const PG_TYPE_TO_UIDT: Record<string, string> = {
         "character varying": "SingleLineText",
         "varchar":           "SingleLineText",
         "text":              "LongText",
         "integer":           "Number",
         "bigint":            "Number",
         "smallint":          "Number",
         "numeric":           "Decimal",
         "real":              "Decimal",
         "double precision":  "Decimal",
         "boolean":           "Checkbox",
         "date":              "Date",
         "timestamp with time zone":    "DateTime",
         "timestamp without time zone": "DateTime",
         "jsonb":             "JSON",
         "json":              "JSON",
         "uuid":              "SingleLineText",
       };

       Implementation in schema.ts:
       export function createSchemaRoutes(db: Db, auth: BetterAuthInstance) {
         const app = new Hono();
         app.use("*", authMiddleware(auth));

         const ALLOWED_TABLES = new Set([
           "contacts", "companies", "deals", "tasks", "contact_notes",
           "deal_notes", "sales", "tags", "contacts_summary", "companies_summary",
         ]);

         const SYSTEM_COLUMNS = new Set(["id", "created_at", "updated_at", "sales_id", "organization_id"]);

         app.get("/:tableName", async (c) => {
           const tableName = c.req.param("tableName");
           if (!ALLOWED_TABLES.has(tableName)) {
             return c.json({ error: "Table not found" }, 404);
           }

           // For summary views, delegate to the base table
           const baseTable = tableName.replace("_summary", "");
           const rows = await db.execute(
             sql`SELECT column_name, data_type, ordinal_position, is_nullable, column_default
                 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = ${baseTable}
                 ORDER BY ordinal_position`
           );

           // Add synthetic computed columns for summaries
           const extraCols = [];
           if (tableName === "contacts_summary") {
             extraCols.push({ column_name: "company_name", data_type: "character varying", ordinal_position: 999,
       is_nullable: "YES", column_default: null });
             extraCols.push({ column_name: "nb_tasks", data_type: "integer", ordinal_position: 1000, is_nullable:
       "YES", column_default: null });
           }
           if (tableName === "companies_summary") {
             extraCols.push({ column_name: "nb_deals", data_type: "integer", ordinal_position: 999, is_nullable:
       "YES", column_default: null });
             extraCols.push({ column_name: "nb_contacts", data_type: "integer", ordinal_position: 1000, is_nullable:       
       "YES", column_default: null });
           }

           const allCols = [...rows, ...extraCols];
           const columns = allCols.map((row, idx) => ({
             id:           row.column_name,
             fk_model_id:  tableName,
             title:        formatTitle(row.column_name as string),
             column_name:  row.column_name,
             uidt:         PG_TYPE_TO_UIDT[row.data_type as string] ?? "SingleLineText",
             dt:           row.data_type,
             pk:           row.column_name === "id",
             pv:           false,  // overrides resolve this on the client
             rqd:          row.is_nullable === "NO",
             un:           false,
             ai:           row.column_name === "id",
             unique:       row.column_name === "id",
             cdf:          row.column_default ?? null,
             dtxp:         "",
             order:        idx + 1,
             system:       SYSTEM_COLUMNS.has(row.column_name as string),
             meta:         null,
           }));

           return c.json({ columns });
         });

         return app;
       }

       Register in app.ts: app.route("/api/schema", createSchemaRoutes(db, auth));

       2B. Views CRUD Route

       Create packages/server/src/routes/views.ts.

       Purpose: Replace all 10 NocoDB Meta API calls made by use-noco-views.ts and use-views.ts.

       The response shapes of every endpoint below must exactly mirror what NocoDB returned so that the mapper
       functions in use-noco-views.ts (mapView, mapViewColumn, mapViewSort, mapViewFilter) work without modification.      

       Endpoints:

       GET /api/views/:objectSlug — List views for a table (replaces GET /api/v2/meta/tables/{tableId}/views)
       Response: { list: NocoViewRaw[] }
       // NocoViewRaw: { id, title, type: number, order, is_default, lock_type }
       // type numbers: grid=3, kanban=2, gallery=4, form=5
       Filters by object_slug = :objectSlug AND sales_id = <current user's sales_id>. If no views exist yet for this       
       slug+sales, auto-create a default "Grid View" (type=3, is_default=true, order=0) and return it.

       POST /api/views/:objectSlug — Create a view (replaces POST /api/v2/meta/tables/{tableId}/views)
       Body:    { title: string, type: number }
       Response: { id, title, type: number, order, is_default }

       GET /api/views/view/:viewId/columns — View columns (replaces GET /api/v2/meta/views/{viewId}/columns)
       Response: { list: NocoViewColumnRaw[] }
       // NocoViewColumnRaw: { id, fk_column_id, title, show, order, width }
       Maps view_columns.field_id to fk_column_id, display_order to order.

       PATCH /api/views/view/:viewId/columns/:columnId — Update column visibility/order/width (replaces PATCH
       /api/v2/meta/views/{viewId}/columns/{columnId})
       Body:     { show?: boolean, order?: number, width?: string }
       Response: NocoViewColumnRaw (updated)

       GET /api/views/view/:viewId/sorts — List sorts (replaces GET /api/v2/meta/views/{viewId}/sorts)
       Response: { list: NocoViewSortRaw[] }
       // NocoViewSortRaw: { id, fk_column_id, direction, order }

       POST /api/views/view/:viewId/sorts — Create sort (replaces POST /api/v2/meta/views/{viewId}/sorts)
       Body:     { fk_column_id: string, direction: "asc"|"desc" }
       Response: NocoViewSortRaw

       DELETE /api/views/view/:viewId/sorts/:sortId — Delete sort (replaces DELETE
       /api/v2/meta/views/{viewId}/sorts/{sortId})
       Response: {} (204 or 200)

       GET /api/views/view/:viewId/filters — List filters (replaces GET /api/v2/meta/views/{viewId}/filters)
       Response: { list: NocoViewFilterRaw[] }
       // NocoViewFilterRaw: { id, fk_column_id, comparison_op, value, logical_op }

       POST /api/views/view/:viewId/filters — Create filter (replaces POST /api/v2/meta/views/{viewId}/filters)
       Body:     { fk_column_id: string, comparison_op: string, value: unknown, logical_op?: "and"|"or" }
       Response: NocoViewFilterRaw

       DELETE /api/views/view/:viewId/filters/:filterId — Delete filter (replaces DELETE
       /api/v2/meta/views/{viewId}/filters/{filterId})
       Response: {}

       Security: Every view route verifies that the view_id belongs to the authenticated user's sales_id. Views are        
       user-scoped, not org-scoped (matching NocoDB's per-user personal views behavior).

       Register in app.ts before the CRM generic routes:
       app.route("/api/views", createViewRoutes(db, auth));

       2C. Generic Filter Enhancement to CRM Route

       Modify packages/server/src/routes/crm.ts to support a filters query param in addition to the existing filter        
       param.

       Current: ?filter={"q":"search","status":"active"} handles resource-specific fields.
       New addition: ?filters=[{"field":"first_name","op":"like","value":"john"},...] enables view-level generic
       filters.

       In the app.get("/:resource") handler, after the existing filter parsing block, add:

       const filtersParam = c.req.query("filters");
       let genericFilters: Array<{field: string; op: string; value: string}> = [];
       if (filtersParam) {
         try {
           genericFilters = JSON.parse(filtersParam);
         } catch { /* ignore */ }
       }

       Then for the table query, build additional SQL conditions from genericFilters using a helper:

       function buildGenericFilter(table: PgTableWithColumns<any>, f: {field: string; op: string; value: string}): SQL     
        | null {
         const col = (table as Record<string, unknown>)[camelCase(f.field)];
         if (!col) return null;
         switch (f.op) {
           case "eq":       return eq(col as SQL, f.value);
           case "neq":      return ne(col as SQL, f.value);
           case "like":     return ilike(col as SQL, `%${f.value}%`);
           case "nlike":    return not(ilike(col as SQL, `%${f.value}%`));
           case "gt":       return gt(col as SQL, f.value);
           case "lt":       return lt(col as SQL, f.value);
           case "gte":      return gte(col as SQL, f.value);
           case "lte":      return lte(col as SQL, f.value);
           case "blank":    return isNull(col as SQL);
           case "notblank": return isNotNull(col as SQL);
           default:         return null;
         }
       }

       Add generated conditions to the conditions[] array before the query execution.

       ---
       Phase 3: Frontend — Replace NocoDB Data CRUD

       3A. Rewrite src/lib/api/crm-nocodb.ts

       Replace the entire file with a new implementation that calls the Hono /api/:resource routes. The file keeps the     
        same exported function signatures (getList, getOne, create, update, remove, setNocoSalesId).

       Key translations:

       ┌──────────────────────────────────────────────┬───────────────────────────────────────────────────────────────     
       ──────┐
       │                    NocoDB                    │                                Hono
             │
       ├──────────────────────────────────────────────┼───────────────────────────────────────────────────────────────     
       ──────┤
       │ limit/offset                                 │ range=[start,end] where start = (page-1)*perPage, end =
             │
       │                                              │ start+perPage-1
             │
       ├──────────────────────────────────────────────┼───────────────────────────────────────────────────────────────     
       ──────┤
       │ where string                                 │ filters JSON array
             │
       ├──────────────────────────────────────────────┼───────────────────────────────────────────────────────────────     
       ──────┤
       │ sort=-field (minus = DESC)                   │ sort=field&order=DESC
             │
       ├──────────────────────────────────────────────┼───────────────────────────────────────────────────────────────     
       ──────┤
       │ Response: { list: [], pageInfo: { totalRows  │ Response: JSON array + Content-Range header
             │
       │ } }                                          │
             │
       ├──────────────────────────────────────────────┼───────────────────────────────────────────────────────────────     
       ──────┤
       │ PATCH body: [{ Id, ...fields }]              │ PUT /api/:resource/:id body: { ...fields }
             │
       ├──────────────────────────────────────────────┼───────────────────────────────────────────────────────────────     
       ──────┤
       │ DELETE body: [{ id }]                        │ DELETE /api/:resource/:id
             │
       └──────────────────────────────────────────────┴───────────────────────────────────────────────────────────────     
       ──────┘

       The extraWhere parameter (pre-built NocoDB where clause) is converted to a filters JSON array. The NocoDB where     
        clause format (field,op,value)~and(field2,op2,value2) is parsed into [{field,op,value}] objects.

       New getList implementation:
       export async function getList<T>(
         resource: string,
         params: ListParams = {},
       ): Promise<{ data: T[]; total: number }> {
         const { pagination = { page: 1, perPage: 25 }, sort, filter = {}, extraWhere } = params;

         const start = (pagination.page - 1) * pagination.perPage;
         const end = start + pagination.perPage - 1;

         const qs = new URLSearchParams();
         qs.set("range", JSON.stringify([start, end]));

         if (sort?.field) {
           qs.set("sort", sort.field);
           qs.set("order", sort.order ?? "ASC");
         }

         // Resource-specific filter (q, status, etc.) — keep for backward compat
         if (Object.keys(filter).length > 0) {
           qs.set("filter", JSON.stringify(filter));
         }

         // Convert extraWhere NocoDB clause to generic filters array
         if (extraWhere) {
           const parsed = parseNocoWhereToFilters(extraWhere);
           if (parsed.length > 0) {
             qs.set("filters", JSON.stringify(parsed));
           }
         }

         return fetchApiList<T>(`/api/${resource}?${qs.toString()}`);
       }

       New getOne:
       export async function getOne<T>(resource: string, id: number | string): Promise<T> {
         return fetchApi<T>(`/api/${resource}/${id}`);
       }

       New create:
       export async function create<T>(resource: string, data: unknown): Promise<T> {
         return fetchApi<T>(`/api/${resource}`, {
           method: "POST",
           body: JSON.stringify(data),
         });
       }

       New update:
       export async function update<T>(resource: string, id: number | string, data: unknown): Promise<T> {
         const body = { ...(data as Record<string, unknown>) };
         delete body.id;
         delete body.Id;
         return fetchApi<T>(`/api/${resource}/${id}`, {
           method: "PUT",
           body: JSON.stringify(body),
         });
       }

       New remove:
       export async function remove<T>(resource: string, id: number | string): Promise<T> {
         return fetchApi<T>(`/api/${resource}/${id}`, { method: "DELETE" });
       }

       parseNocoWhereToFilters helper — converts the NocoDB (field,op,value)~and(field2,op2,value2) string that
       ObjectListPage.tsx builds from view filters back into a FilterDef[] array. This is needed because
       ObjectListPage.tsx builds extraWhere as a NocoDB-style string and passes it to getList. After Phase 5, this
       translation shim can be removed.

       function parseNocoWhereToFilters(where: string): FilterDef[] {
         const clauseRe = /\(([^,]+),([^,]+),([^)]*)\)/g;
         const filters: FilterDef[] = [];
         let match;
         while ((match = clauseRe.exec(where)) !== null) {
           filters.push({ field: match[1], op: match[2] as FilterOp, value: match[3] });
         }
         return filters;
       }

       3B. Remove setNocoSalesId call dependency

       The setNocoSalesId(salesId) call in NocoDBProvider.tsx used to scope all queries. With Hono routes, the
       sales_id scoping happens server-side (the auth middleware looks up sales_id from the session on every request).     
        So setNocoSalesId becomes a no-op stub that stays exported for now but does nothing. The SALES_SCOPED set and      
       getSalesIdForResource function can be deleted from the rewritten crm-nocodb.ts.

       3C. Update src/lib/api/crm.ts

       Remove the extraWhere from ListParams since it is now encapsulated inside crm-nocodb.ts:

       Actually, keep extraWhere in ListParams because use-records.ts and ObjectListPage.tsx pass it through. The
       translation happens in getList in crm-nocodb.ts. Only internal NocoDB implementation details disappear.

       No change to crm.ts except verifying the imports still resolve.

       ---
       Phase 4: Frontend — Replace NocoDB View Persistence

       4A. Rewrite src/hooks/use-noco-views.ts

       Replace all nocoFetch calls with fetchApi calls to the new Hono view routes. The key constraint is that the
       response shapes must stay identical to what the mappers (mapView, mapViewColumn, etc.) already expect, which        
       they will because the Hono routes are designed to return NocoDB-identical shapes.

       Changed lines per function:

       useNocoViews(resource):
       // OLD: nocoFetch<{ list: NocoViewRaw[] }>(`/api/v2/meta/tables/${tableId}/views`)
       // NEW:
       const response = await fetchApi<{ list: NocoViewRaw[] }>(`/api/views/${resource}`);
       Remove the getTableId(resource) call. Remove the import of nocoFetch and getTableId.

       useNocoViewColumns(viewId):
       // OLD: nocoFetch<{ list: NocoViewColumnRaw[] }>(`/api/v2/meta/views/${viewId}/columns`)
       // NEW:
       const response = await fetchApi<{ list: NocoViewColumnRaw[] }>(`/api/views/view/${viewId}/columns`);

       useUpdateNocoViewColumn(viewId) mutation:
       // OLD: nocoFetch<NocoViewColumnRaw>(`/api/v2/meta/views/${viewId}/columns/${columnId}`, { method: "PATCH", ...     
        })
       // NEW:
       const raw = await fetchApi<NocoViewColumnRaw>(`/api/views/view/${viewId}/columns/${columnId}`, {
         method: "PATCH",
         body: JSON.stringify(updates),
       });

       useNocoViewSorts(viewId):
       // OLD: nocoFetch<{ list: NocoViewSortRaw[] }>(`/api/v2/meta/views/${viewId}/sorts`)
       // NEW:
       const response = await fetchApi<{ list: NocoViewSortRaw[] }>(`/api/views/view/${viewId}/sorts`);

       useCreateNocoViewSort(viewId):
       // OLD: nocoFetch<NocoViewSortRaw>(`/api/v2/meta/views/${viewId}/sorts`, { method: "POST", ... })
       // NEW:
       const raw = await fetchApi<NocoViewSortRaw>(`/api/views/view/${viewId}/sorts`, {
         method: "POST",
         body: JSON.stringify(body),
       });

       useDeleteNocoViewSort(viewId):
       // OLD: nocoFetch(`/api/v2/meta/views/${viewId}/sorts/${sortId}`, { method: "DELETE" })
       // NEW:
       await fetchApi(`/api/views/view/${viewId}/sorts/${sortId}`, { method: "DELETE" });

       Same pattern for useNocoViewFilters, useCreateNocoViewFilter, useDeleteNocoViewFilter.

       Remove all imports of nocoFetch and getTableId. Add import of fetchApi from @/lib/api.

       4B. Rewrite src/hooks/use-views.ts — createView mutation

       The createView mutation in useViews also calls nocoFetch directly to POST /api/v2/meta/tables/{tableId}/views.      
       Change to:
       // OLD: nocoFetch<NocoViewCreateRaw>(`/api/v2/meta/tables/${tableId}/views`, { method: "POST", ... })
       // NEW:
       const raw = await fetchApi<NocoViewCreateRaw>(`/api/views/${objectSlug}`, {
         method: "POST",
         body: JSON.stringify({ title, type: VIEW_TYPE_TO_NOCO[type] ?? 3 }),
       });
       Remove getTableId and nocoFetch imports.

       4C. Rewrite src/hooks/use-nocodb-columns.ts

       useTableColumns(resource): Replace NocoDB meta call with the new schema endpoint:
       // OLD: nocoFetch<{ columns: NocoDBColumn[] }>(`/api/v2/meta/tables/${tableId}`)
       // NEW:
       const response = await fetchApi<{ columns: NocoDBColumn[] }>(`/api/schema/${resource}`);
       return response.columns;
       The NocoDBColumn type does not change. The server returns the same fields.

       useCreateColumn(): This currently POSTs to NocoDB to create a new Postgres column via POST
       /api/v2/meta/tables/{tableId}/columns. After removing NocoDB, there is no equivalent. Two options:

       Option A (recommended): Route useCreateColumn to the existing POST /api/custom_field_defs endpoint (which
       already records a custom field definition). Then the schema endpoint returns custom_field_defs rows in addition     
        to information_schema.columns. This keeps the customFields JSONB pattern already in the schema.

       Option B: Add a real DDL endpoint POST /api/schema/:tableName/columns that runs ALTER TABLE ... ADD COLUMN.
       This is risky in production and requires migration tooling.

       Recommended (Option A): Map useCreateColumn to POST /api/custom_field_defs:
       mutationFn: async (params) => {
         const safeName = params.title.toLowerCase().replace(/[^a-z0-9]/g, "_");
         const row = await fetchApi<CustomFieldDef>("/api/custom_field_defs", {
           method: "POST",
           body: JSON.stringify({
             resource: params.resource,
             name: safeName,
             label: params.title,
             fieldType: params.fieldType,
             options: params.options?.map(o => typeof o === "string" ? o : o.label),
           }),
         });
         // Return a NocoDBColumn-shaped object for compatibility with onSuccess invalidation
         return {
           id: String(row.id),
           column_name: row.name,
           title: row.label,
           uidt: FIELD_TYPE_TO_UIDT[params.fieldType] ?? "SingleLineText",
           // ... other NocoDBColumn fields with safe defaults
         } as NocoDBColumn;
       }
       And update GET /api/schema/:tableName to also return custom_field_defs rows for the resource, translated to the     
        NocoDBColumn shape.

       useDeleteColumn(): Maps to DELETE /api/custom_field_defs/:id. The columnId passed in is now the numeric DB id       
       stringified.

       4D. Rewrite src/providers/ObjectRegistryProvider.tsx

       The only NocoDB-specific change is replacing the column fetch URL. Replace:
       // OLD:
       const response = await nocoFetch<{ columns: NocoDBColumn[] }>(
         `/api/v2/meta/tables/${cfg._tableId}`,
       );
       with:
       // NEW (using fetchApi + the schema endpoint):
       const response = await fetchApi<{ columns: NocoDBColumn[] }>(
         `/api/schema/${cfg.nocoTableName}`,
       );

       Also remove:
       - import { nocoFetch } from "@/lib/nocodb/client";
       - import { getTableMap } from "@/lib/nocodb/table-map";
       - The resolveTableId function (no longer needed)
       - The _tableId property from activeConfigs mapping

       The query key changes from ["nocodb-columns", cfg.nocoTableName] to ["schema-columns", cfg.nocoTableName] (or       
       keep the same key — both work).

       The cfg.nocoTableName field is still present in ObjectConfig and used as the table name to query. The
       object_config.noco_table_name column in Postgres stores "contacts", "companies", etc. — these are the same
       names as Postgres table names. No data migration needed.

       4E. Handle Attribute.nocoUidt field

       Decision: Rename nocoUidt to sqlType in src/types/objects.ts and in ObjectRegistryProvider.tsx.

       Rationale: The field now holds the Postgres-derived uidt string (still using NocoDB's naming for the value like     
        "SingleLineText", "DateTime", etc. because that mapping already exists). The field name nocoUidt misleads
       future maintainers. Rename it at the type level.

       Changes:
       - src/types/objects.ts: rename nocoUidt: string to sqlType: string
       - src/providers/ObjectRegistryProvider.tsx: rename nocoUidt: col.uidt to sqlType: col.uidt in mergeAttributes       
       - Search entire codebase for other uses of nocoUidt:
         - ObjectRegistryProvider.tsx uses col.uidt === "SingleSelect" etc. — these are local variable references, not     
        the Attribute.nocoUidt property
         - The isSelectType check and mappedUiType reference col.uidt directly, not attribute.nocoUidt
         - Result: the rename is isolated to the type definition and the one assignment in mergeAttributes

       ---
       Phase 5: Frontend — Remove NocoDB Provider and Dead Code

       5A. Modify src/App.tsx

       Remove <NocoDBProvider> wrapper and its import:
       // REMOVE: import { NocoDBProvider } from "@/providers/NocoDBProvider";
       // REMOVE the wrapping element in the JSX:
       // <NocoDBProvider>
       //   <ObjectRegistryProvider>
       //     ...
       //   </ObjectRegistryProvider>
       // </NocoDBProvider>
       // KEEP just:
       // <ObjectRegistryProvider>
       //   ...
       // </ObjectRegistryProvider>

       No loading gate is needed from NocoDBProvider since there is no longer a separate config fetch to wait for. The     
        ObjectRegistryProvider loading state already gates the UI.

       5B. Delete Files

       - src/providers/NocoDBProvider.tsx — DELETE
       - src/hooks/use-nocodb.ts — DELETE (provides NocoDBContext consumed only by NocoDBProvider)
       - src/lib/nocodb/client.ts — DELETE
       - src/lib/nocodb/table-map.ts — DELETE

       5C. Keep or Repurpose

       - src/lib/nocodb/filters.ts — KEEP FilterOp, FilterDef, buildFilterParam types/helpers (used for the generic        
       filter array format). Remove buildWhereClause, buildSortParam, buildMultiSortParam since those generate NocoDB      
       syntax. Alternatively rename the file to src/lib/api/filters.ts and update imports.
       - src/lib/nocodb/field-mapper.ts — KEEP. snakeToCamel/camelToSnake are general utilities. Move to
       src/lib/utils.ts or rename file to src/lib/field-mapper.ts.

       5D. Update ObjectListPage.tsx — Remove extraWhere

       Currently ObjectListPage.tsx builds an extraWhere NocoDB where string from view filters and passes it to
       useRecords. After Phase 3 the parseNocoWhereToFilters shim handles this transparently, but it should be cleaned     
        up.

       Replace the extraWhere useMemo with a viewFilters array passed directly:

       // Instead of building extraWhere string, pass filters directly
       const viewFilterParams = useMemo(() => {
         if (!viewState.filters.length) return undefined;
         return viewState.filters.map((f) => {
           const attr = attributes.find((a) => a.id === f.fieldId);
           const colName = attr?.columnName ?? f.fieldId;
           return { field: colName, op: f.operator || "eq", value: String(f.value ?? "") };
         });
       }, [viewState.filters, attributes]);

       And update useRecords call to pass viewFilters: viewFilterParams instead of extraWhere. Update UseRecordsParams     
        to replace extraWhere?: string with viewFilters?: FilterDef[], and update getList in crm-nocodb.ts
       accordingly.

       This is the clean-up that removes the last NocoDB syntax artifact from the frontend. It can be done as a
       follow-up after Phase 3 is verified working.

       5E. Update Backend: Remove NocoDB Config Route and Env Vars

       - Delete packages/server/src/routes/nocodb-config.ts
       - Delete packages/server/src/routes/nocodb-webhooks.ts (if present — it is in the routes listing)
       - In packages/server/src/app.ts: remove import { createNocoDBConfigRoutes } and app.route("/api/nocodb-config",     
        ...) line
       - In packages/server/src/env.ts: remove NOCODB_BASE_URL, NOCODB_API_TOKEN, NOCODB_BASE_ID,
       NOCODB_WEBHOOK_SECRET from the Zod schema
       - Remove from docker-compose.yml: the entire nocodb: service block and nocodb_data: volume

       ---
       Phase 6: ObjectConfig — Rename nocoTableName Field (Optional)

       The object_config table has a column noco_table_name which now simply means "the Postgres table name for this       
       object". Renaming is optional since nocoTableName still accurately identifies which table to query. If desired:     

       - Create a migration: ALTER TABLE object_config RENAME COLUMN noco_table_name TO table_name;
       - Update Drizzle schema: rename field in object-config.ts
       - Update ObjectConfigApiResponse and ObjectConfig types: rename nocoTableName to tableName
       - Update ObjectRegistryProvider.tsx: update all references
       - Update object-config route: update the PUT /:slug body field
       - Data stays the same (values like "contacts", "companies" are unchanged)

       Recommendation: Do this rename in a separate PR after everything else is working. The functional impact is zero     
        if deferred.

       ---
       Implementation Order (to avoid breaking the running app)

       1. Phase 1 — DB schema. Run migration. App still uses NocoDB. No frontend changes.
       2. Phase 2A — Add GET /api/schema/:tableName. App still uses NocoDB. Verify endpoint manually.
       3. Phase 2B — Add view CRUD routes. App still uses NocoDB. Verify endpoints manually.
       4. Phase 2C — Add generic filters param to CRM route. Backward compatible (existing requests ignore new param).     
       5. Phase 3A+3B+3C — Rewrite crm-nocodb.ts. This is the hot-swap. Data CRUD now goes to Hono. Test record
       list/create/update/delete for each resource.
       6. Phase 4A+4B — Rewrite view hooks. Views now persist in Postgres. Test view create, column visibility, sort,      
       filter save.
       7. Phase 4C — Rewrite column hooks (schema introspection). Test ObjectListPage loads correct columns.
       8. Phase 4D — Rewrite ObjectRegistryProvider. Verify object registry loads with correct attributes.
       9. Phase 5A–5E — Remove NocoDB provider, dead code, docker-compose entry, env vars.
       10. Phase 5D — Clean up extraWhere → viewFilters in ObjectListPage.tsx and use-records.ts.
       11. Phase 6 (optional) — Rename nocoTableName → tableName.

       ---
       Data Migration Consideration

       Existing view state in NocoDB (user-created views, saved filters, sorts, column widths) will be lost when
       NocoDB is removed. If users have important saved views, export them from NocoDB's API before shutdown and write     
        a one-time migration script to insert them into the new views, view_columns, view_sorts, view_filters tables.      
       For a fresh installation, this is not a concern.

       ---
       Summary of All File Changes

       Files to CREATE:

       - packages/server/src/db/schema/views.ts — Drizzle schema for 4 new tables
       - packages/server/src/routes/schema.ts — GET /api/schema/:tableName endpoint
       - packages/server/src/routes/views.ts — Full view CRUD (10 endpoints mirroring NocoDB shapes)
       - packages/server/drizzle/<timestamp>_views.sql — Generated migration (via drizzle-kit generate)

       Files to MODIFY:

       - packages/server/src/db/schema/index.ts — Add export * from "./views.js"
       - packages/server/src/app.ts — Add schema + views routes, remove nocodb-config route
       - packages/server/src/env.ts — Remove 4 NOCODB_* env vars
       - packages/server/src/routes/crm.ts — Add generic filters param support
       - src/lib/api/crm-nocodb.ts — Full rewrite (Hono calls instead of NocoDB)
       - src/lib/api/crm.ts — No functional change; verify imports
       - src/hooks/use-noco-views.ts — Replace nocoFetch with fetchApi for all 10 calls
       - src/hooks/use-views.ts — Replace nocoFetch + getTableId in createView mutation
       - src/hooks/use-nocodb-columns.ts — Replace Meta API calls with schema endpoint + custom_field_defs
       - src/providers/ObjectRegistryProvider.tsx — Replace NocoDB column fetch with schema endpoint
       - src/types/objects.ts — Rename nocoUidt to sqlType
       - src/App.tsx — Remove <NocoDBProvider> wrapper
       - docker-compose.yml — Remove nocodb: service and nocodb_data: volume
       - src/lib/nocodb/filters.ts — Remove NocoDB-specific functions, keep type definitions
       - src/components/create-attribute/CreateAttributeModal.tsx — No change needed if useCreateColumn signature
       stays same

       Files to DELETE:

       - src/providers/NocoDBProvider.tsx
       - src/hooks/use-nocodb.ts
       - src/lib/nocodb/client.ts
       - src/lib/nocodb/table-map.ts
       - packages/server/src/routes/nocodb-config.ts
       - packages/server/src/routes/nocodb-webhooks.ts

       Files UNCHANGED:

       - src/types/views.ts — No changes
       - src/hooks/use-records.ts — No changes (uses crm-nocodb.ts through crm.ts re-exports)
       - src/hooks/use-object-registry.ts — No changes
       - src/components/pages/ObjectListPage.tsx — Minor cleanup in Phase 5D only
       - src/components/pages/RecordDetailPage.tsx — No changes
       - All data-table, kanban, spreadsheet components — No changes

       ---
       Critical Files for Implementation

       - packages/server/src/routes/crm.ts - Core logic to extend with generic filters param support; the foundation       
       that all CRUD now routes through
       - packages/server/src/db/schema/views.ts - New file to create; defines all 4 Postgres tables that replace
       NocoDB's view persistence storage
       - src/lib/api/crm-nocodb.ts - Core frontend CRUD adapter to fully rewrite; the single hot-swap that eliminates      
       NocoDB from all data operations
       - src/hooks/use-noco-views.ts - View persistence hook to rewrite; contains all 10 NocoDB Meta API calls that        
       map 1:1 to the new Hono view routes
       - src/providers/ObjectRegistryProvider.tsx - Schema introspection consumer to update; replaces NocoDB column        
       metadata calls with the new /api/schema/:tableName endpoint and drives the entire attribute system