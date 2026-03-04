import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { createAuth } from "../auth.js";
import { sql, eq, asc, and, or, isNull } from "drizzle-orm";
import * as schema from "../db/schema/index.js";
import { PERMISSIONS, requirePermission } from "../lib/rbac.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

const ALLOWED_TABLES = new Set([
  "contacts",
  "companies",
  "deals",
  "tasks",
  "contact_notes",
  "deal_notes",
  "crm_users",
  "tags",
  "contacts_summary",
  "companies_summary",
]);

const SYSTEM_COLUMNS = new Set([
  "id",
  "created_at",
  "updated_at",
  "crm_user_id",
  "organization_id",
]);

const PG_TYPE_TO_UIDT: Record<string, string> = {
  "character varying": "SingleLineText",
  varchar: "SingleLineText",
  text: "LongText",
  integer: "Number",
  bigint: "Number",
  smallint: "Number",
  numeric: "Decimal",
  real: "Decimal",
  "double precision": "Decimal",
  boolean: "Checkbox",
  date: "Date",
  "timestamp with time zone": "DateTime",
  "timestamp without time zone": "DateTime",
  jsonb: "JSON",
  json: "JSON",
  uuid: "SingleLineText",
};

const FIELD_TYPE_TO_UIDT: Record<string, string> = {
  text: "SingleLineText",
  "long-text": "LongText",
  number: "Number",
  currency: "Currency",
  select: "SingleSelect",
  "multi-select": "MultiSelect",
  status: "SingleSelect",
  checkbox: "Checkbox",
  date: "Date",
  timestamp: "DateTime",
  rating: "Rating",
  email: "Email",
  domain: "URL",
  phone: "PhoneNumber",
  location: "SingleLineText",
  user: "SingleLineText",
  relationship: "LinkToAnotherRecord",
  boolean: "Checkbox",
  url: "URL",
  longText: "LongText",
};

interface SchemaColumnRow {
  column_name: string;
  data_type: string;
  ordinal_position: number;
  is_nullable: string;
  column_default: string | null;
}

function formatTitle(columnName: string): string {
  if (/[_]/.test(columnName) || /^[A-Z_]+$/.test(columnName)) {
    return columnName
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return columnName;
}

function toNocoDBColumnShape(
  row: SchemaColumnRow,
  tableName: string,
  order: number
): Record<string, unknown> {
  return {
    id: row.column_name,
    fk_model_id: tableName,
    title: formatTitle(row.column_name),
    column_name: row.column_name,
    uidt: PG_TYPE_TO_UIDT[row.data_type] ?? "SingleLineText",
    dt: row.data_type,
    pk: row.column_name === "id",
    pv: false,
    rqd: row.is_nullable === "NO",
    un: false,
    ai: row.column_name === "id",
    unique: row.column_name === "id",
    cdf: row.column_default ?? null,
    dtxp: "",
    order,
    system: SYSTEM_COLUMNS.has(row.column_name),
    meta: null,
    np: null,
    ns: null,
    clen: null,
    cop: "",
    cc: "",
    csn: "",
    dtx: "",
    dtxs: "",
    au: false,
  };
}

export function createSchemaRoutes(db: Db, auth: BetterAuthInstance) {
  const app = new Hono();
  app.use("*", authMiddleware(auth, db));

  app.get("/:tableName", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const orgId = authz.crmUser.organizationId;
    if (!orgId) return c.json({ error: "Organization not found" }, 404);

    const tableName = c.req.param("tableName");
    if (!ALLOWED_TABLES.has(tableName)) {
      return c.json({ error: "Table not found" }, 404);
    }

    const baseTable = tableName.replace("_summary", "");

    const result = await db.execute(
      sql`SELECT column_name, data_type, ordinal_position, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ${baseTable}
          ORDER BY ordinal_position`
    );

    const raw = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
    const rows = raw as SchemaColumnRow[];

    const extraCols: SchemaColumnRow[] = [];
    if (tableName === "contacts_summary") {
      extraCols.push(
        {
          column_name: "company_name",
          data_type: "character varying",
          ordinal_position: 999,
          is_nullable: "YES",
          column_default: null,
        },
        {
          column_name: "nb_tasks",
          data_type: "integer",
          ordinal_position: 1000,
          is_nullable: "YES",
          column_default: null,
        }
      );
    }
    if (tableName === "companies_summary") {
      extraCols.push(
        {
          column_name: "nb_deals",
          data_type: "integer",
          ordinal_position: 999,
          is_nullable: "YES",
          column_default: null,
        },
        {
          column_name: "nb_contacts",
          data_type: "integer",
          ordinal_position: 1000,
          is_nullable: "YES",
          column_default: null,
        }
      );
    }

    const allCols = [...rows, ...extraCols];
    const columns = allCols.map((row, idx) =>
      toNocoDBColumnShape(row, tableName, idx + 1)
    );

    const resourceForCustom = baseTable;
    const customRows = await db
      .select()
      .from(schema.customFieldDefs)
      .where(
        and(
          eq(schema.customFieldDefs.resource, resourceForCustom),
          or(
            eq(schema.customFieldDefs.organizationId, orgId),
            isNull(schema.customFieldDefs.organizationId)
          )
        )
      )
      .orderBy(asc(schema.customFieldDefs.position), asc(schema.customFieldDefs.id));

    for (const def of customRows) {
      const uidt = FIELD_TYPE_TO_UIDT[def.fieldType] ?? "SingleLineText";
      columns.push({
        id: `custom_${def.id}`,
        fk_model_id: tableName,
        title: def.label,
        column_name: def.name,
        uidt,
        dt: "varchar",
        pk: false,
        pv: false,
        rqd: false,
        un: false,
        ai: false,
        unique: false,
        cdf: null,
        dtxp: Array.isArray(def.options) ? def.options.join(",") : "",
        order: columns.length + 1,
        system: false,
        meta: null,
        np: null,
        ns: null,
        clen: null,
        cop: "",
        cc: "",
        csn: "",
        dtx: "",
        dtxs: "",
        au: false,
      });
    }

    return c.json({ columns });
  });

  return app;
}
