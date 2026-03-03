import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import type { createAuth } from "../auth.js";
import * as schema from "../db/schema/index.js";
import {
  eq,
  ne,
  and,
  or,
  not,
  ilike,
  gt,
  lt,
  gte,
  lte,
  isNull,
  isNotNull,
  sql,
  desc,
  asc,
  type SQL,
} from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";
import {
  buildEntityText,
  getEntityType,
  upsertEntityEmbedding,
  deleteEntityEmbedding,
} from "../lib/embeddings.js";
import { fireEvent, reloadRule } from "../lib/automation-engine.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

const CRM_RESOURCES = [
  "contacts",
  "companies",
  "deals",
  "contact_notes",
  "deal_notes",
  "tasks",
  "sales",
  "tags",
  "configuration",
  "automation_rules",
  "companies_summary",
  "contacts_summary",
] as const;

type Resource = (typeof CRM_RESOURCES)[number];

const TABLE_MAP: Record<
  Exclude<Resource, "companies_summary" | "contacts_summary">,
  PgTableWithColumns<any>
> = {
  contacts: schema.contacts,
  companies: schema.companies,
  deals: schema.deals,
  contact_notes: schema.contactNotes,
  deal_notes: schema.dealNotes,
  tasks: schema.tasks,
  sales: schema.sales,
  tags: schema.tags,
  configuration: schema.configuration,
  automation_rules: schema.automationRules,
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    // Drizzle timestamp columns require Date objects, not strings
    result[camel] = typeof v === "string" && ISO_DATE_RE.test(v) ? new Date(v) : v;
  }
  return result;
}

function hasSalesId(resource: Resource): boolean {
  return [
    "companies",
    "deals",
    "contact_notes",
    "deal_notes",
    "tasks",
    "sales",
    "automation_rules",
  ].includes(resource);
}

function snakeToCamelField(field: string): string {
  return field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

interface GenericFilter {
  field: string;
  op: string;
  value: string;
}

function buildGenericFilterCondition(
  table: PgTableWithColumns<any>,
  f: GenericFilter
): SQL | null {
  const col = (table as Record<string, unknown>)[snakeToCamelField(f.field)];
  if (!col || typeof (col as { getSQL: unknown }).getSQL !== "function") return null;
  const c = col as SQL;
  switch (f.op) {
    case "eq":
      return eq(c, f.value);
    case "neq":
      return ne(c, f.value);
    case "like":
      return ilike(c, `%${f.value}%`);
    case "nlike":
      return not(ilike(c, `%${f.value}%`));
    case "gt":
      return gt(c, f.value);
    case "lt":
      return lt(c, f.value);
    case "gte":
      return gte(c, f.value);
    case "lte":
      return lte(c, f.value);
    case "blank":
      return isNull(c);
    case "notblank":
      return isNotNull(c);
    default:
      return null;
  }
}

export function createCrmRoutes(
  db: Db,
  auth: BetterAuthInstance,
  env: Env
) {
  const app = new Hono();

  app.use("*", authMiddleware(auth));

  app.post("/merge_contacts", async (c) => {
    const body = await c.req.json<{ loserId: number; winnerId: number }>();
    const { loserId, winnerId } = body;
    if (!loserId || !winnerId) {
      return c.json({ error: "loserId and winnerId required" }, 400);
    }

    const session = c.get("session") as { user?: { id: string } };
    const salesRow = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);
    const salesId = salesRow[0]?.id;
    if (!salesId) return c.json({ error: "User not found in CRM" }, 404);

    const [loser] = await db
      .select()
      .from(schema.contacts)
      .where(and(eq(schema.contacts.id, loserId), eq(schema.contacts.salesId, salesId)))
      .limit(1);
    const [winner] = await db
      .select()
      .from(schema.contacts)
      .where(and(eq(schema.contacts.id, winnerId), eq(schema.contacts.salesId, salesId)))
      .limit(1);

    if (!loser || !winner) return c.json({ error: "Contact not found" }, 404);

    await db.update(schema.tasks).set({ contactId: winnerId }).where(eq(schema.tasks.contactId, loserId));
    await db.update(schema.contactNotes).set({ contactId: winnerId }).where(eq(schema.contactNotes.contactId, loserId));

    const allDeals = await db.select().from(schema.deals).where(eq(schema.deals.salesId, salesId));
    for (const deal of allDeals) {
      const ids = (deal.contactIds as number[]) ?? [];
      if (ids.includes(loserId)) {
        const next = ids.filter((x) => x !== loserId);
        if (!next.includes(winnerId)) next.push(winnerId);
        await db.update(schema.deals).set({ contactIds: next }).where(eq(schema.deals.id, deal.id));
      }
    }

    await db.delete(schema.contacts).where(eq(schema.contacts.id, loserId));

    return c.json({ id: winnerId });
  });

  app.get("/:resource", async (c) => {
    const resource = c.req.param("resource") as Resource;
    if (!CRM_RESOURCES.includes(resource)) {
      return c.json({ error: "Unknown resource" }, 404);
    }

    const session = c.get("session") as { user?: { id: string } };
    const salesRow = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);
    const salesId = salesRow[0]?.id;
    const orgId = salesRow[0]?.organizationId;
    if (!salesId) return c.json({ error: "User not found in CRM" }, 404);

    const range = c.req.query("range");
    const sortParam = c.req.query("sort");
    const orderParam = c.req.query("order");
    const filterParam = c.req.query("filter");
    const filtersParam = c.req.query("filters");

    let [start, end] = [0, 24];
    if (range) {
      try {
        const parsed = JSON.parse(range) as [number, number];
        if (Array.isArray(parsed) && parsed.length >= 2) {
          [start, end] = parsed;
        }
      } catch {
        /* use defaults */
      }
    }
    const limit = Math.max(0, end - start + 1);
    const offset = start;

    let filter: Record<string, unknown> = {};
    if (filterParam) {
      try {
        filter = JSON.parse(filterParam) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
    }
    const q = typeof filter.q === "string" ? filter.q.trim() : null;

    let genericFilters: GenericFilter[] = [];
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam) as unknown;
        if (Array.isArray(parsed)) {
          genericFilters = parsed.filter(
            (x): x is GenericFilter =>
              x != null &&
              typeof x === "object" &&
              typeof (x as GenericFilter).field === "string" &&
              typeof (x as GenericFilter).op === "string" &&
              typeof (x as GenericFilter).value === "string"
          );
        }
      } catch {
        /* ignore */
      }
    }

    if (resource === "companies_summary") {
      const companyConds: SQL[] = [eq(schema.companies.salesId, salesId)];
      if (q) {
        companyConds.push(
          or(
            ilike(schema.companies.name, `%${q}%`),
            ilike(schema.companies.city, `%${q}%`),
            ilike(schema.companies.sector, `%${q}%`),
          ) as SQL,
        );
      }
      if (filter.sector) companyConds.push(eq(schema.companies.sector, filter.sector as string));

      const rows = await db
        .select({
          ...schema.companies,
          nbDeals: sql<number>`count(distinct ${schema.deals.id})::int`.as("nb_deals"),
          nbContacts: sql<number>`count(distinct ${schema.contacts.id})::int`.as("nb_contacts"),
        })
        .from(schema.companies)
        .leftJoin(schema.deals, eq(schema.companies.id, schema.deals.companyId))
        .leftJoin(schema.contacts, eq(schema.companies.id, schema.contacts.companyId))
        .where(and(...companyConds))
        .groupBy(schema.companies.id)
        .limit(limit)
        .offset(offset);

      const [{ count: total }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.companies)
        .where(and(...companyConds));

      c.header("Content-Range", `companies_summary ${start}-${start + rows.length - 1}/${total}`);
      return c.json(rows);
    }

    if (resource === "contacts_summary") {
      const contactConds: SQL[] = [eq(schema.contacts.salesId, salesId)];
      if (q) {
        contactConds.push(
          or(
            ilike(schema.contacts.firstName, `%${q}%`),
            ilike(schema.contacts.lastName, `%${q}%`),
            ilike(schema.contacts.email, `%${q}%`),
            ilike(schema.companies.name, `%${q}%`),
          ) as SQL,
        );
      }
      if (filter.status) contactConds.push(eq(schema.contacts.status, filter.status as string));
      if (filter.company_id) {
        contactConds.push(eq(schema.contacts.companyId, Number(filter.company_id)));
      }

      const rows = await db
        .select({
          ...schema.contacts,
          companyName: schema.companies.name,
          nbTasks: sql<number>`count(distinct ${schema.tasks.id})::int`.as("nb_tasks"),
        })
        .from(schema.contacts)
        .leftJoin(schema.tasks, eq(schema.contacts.id, schema.tasks.contactId))
        .leftJoin(schema.companies, eq(schema.contacts.companyId, schema.companies.id))
        .where(and(...contactConds))
        .groupBy(schema.contacts.id, schema.companies.name)
        .limit(limit)
        .offset(offset);

      // Count uses same filters (re-run on contacts table; q on company name requires a join)
      const countRows = await db
        .select({ count: sql<number>`count(distinct ${schema.contacts.id})::int` })
        .from(schema.contacts)
        .leftJoin(schema.companies, eq(schema.contacts.companyId, schema.companies.id))
        .where(and(...contactConds));
      const total = countRows[0]?.count ?? 0;

      c.header("Content-Range", `contacts_summary ${start}-${start + rows.length - 1}/${total}`);
      return c.json(rows);
    }

    const table = TABLE_MAP[resource as Exclude<Resource, "companies_summary" | "contacts_summary">];
    if (!table) return c.json({ error: "Unknown resource" }, 404);

    const conditions: SQL[] = [];
    if (resource === "sales") {
      if (orgId) conditions.push(eq(schema.sales.organizationId, orgId));
    } else if (hasSalesId(resource)) {
      conditions.push(eq((table as typeof schema.companies).salesId, salesId));
    }

    // Apply generic field filters for deals
    if (resource === "deals") {
      if (q) conditions.push(ilike(schema.deals.name, `%${q}%`));
      if (filter.stage) conditions.push(eq(schema.deals.stage, filter.stage as string));
      if (filter.category) conditions.push(eq(schema.deals.category, filter.category as string));
      if (filter.company_id) conditions.push(eq(schema.deals.companyId, Number(filter.company_id)));
    }
    if (resource === "tasks" && filter.contact_id != null) {
      conditions.push(eq(schema.tasks.contactId, Number(filter.contact_id)));
    }
    if (resource === "contact_notes" && filter.contact_id != null) {
      conditions.push(eq(schema.contactNotes.contactId, Number(filter.contact_id)));
    }
    if (resource === "deal_notes" && filter.deal_id != null) {
      conditions.push(eq(schema.dealNotes.dealId, Number(filter.deal_id)));
    }

    for (const gf of genericFilters) {
      const cond = buildGenericFilterCondition(table, gf);
      if (cond) conditions.push(cond);
    }

    const sortParamCamel = sortParam ? snakeToCamelField(sortParam) : null;
    const orderByCol = sortParamCamel
      ? (table as Record<string, unknown>)[sortParamCamel]
      : null;
    const orderDir = orderParam === "DESC" ? desc : asc;

    const countResult = await (conditions.length > 0
      ? db.select({ count: sql<number>`count(*)::int` }).from(table).where(and(...conditions))
      : db.select({ count: sql<number>`count(*)::int` }).from(table));
    const total = countResult[0]?.count ?? 0;

    let listQuery = db.select().from(table);
    if (conditions.length > 0) {
      listQuery = listQuery.where(and(...conditions));
    }
    if (orderByCol) {
      listQuery = listQuery.orderBy(orderDir(orderByCol as SQL));
    }
    const rows = await listQuery.limit(limit).offset(offset);

    c.header("Content-Range", `${resource} ${start}-${Math.min(start + rows.length, total)}/${total}`);
    return c.json(rows);
  });

  app.get("/:resource/:id", async (c) => {
    const resource = c.req.param("resource") as Resource;
    const idRaw = c.req.param("id");
    const id = resource === "configuration" ? 1 : parseInt(idRaw, 10);
    if ((resource !== "configuration" && isNaN(id as number)) || !CRM_RESOURCES.includes(resource)) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const session = c.get("session") as { user?: { id: string } };
    const salesRow = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);
    const salesId = salesRow[0]?.id;
    const orgId = salesRow[0]?.organizationId;
    if (!salesId) return c.json({ error: "User not found in CRM" }, 404);

    if (resource === "companies_summary") {
      const [row] = await db
        .select({
          ...schema.companies,
          nbDeals: sql<number>`count(distinct ${schema.deals.id})::int`.as("nb_deals"),
          nbContacts: sql<number>`count(distinct ${schema.contacts.id})::int`.as("nb_contacts"),
        })
        .from(schema.companies)
        .leftJoin(schema.deals, eq(schema.companies.id, schema.deals.companyId))
        .leftJoin(schema.contacts, eq(schema.companies.id, schema.contacts.companyId))
        .where(and(eq(schema.companies.id, id as number), eq(schema.companies.salesId, salesId)))
        .groupBy(schema.companies.id)
        .limit(1);
      if (!row) return c.json({ error: "Not found" }, 404);
      return c.json(row);
    }

    if (resource === "contacts_summary") {
      const [row] = await db
        .select({
          ...schema.contacts,
          companyName: schema.companies.name,
          nbTasks: sql<number>`count(distinct ${schema.tasks.id})::int`.as("nb_tasks"),
        })
        .from(schema.contacts)
        .leftJoin(schema.tasks, eq(schema.contacts.id, schema.tasks.contactId))
        .leftJoin(schema.companies, eq(schema.contacts.companyId, schema.companies.id))
        .where(and(eq(schema.contacts.id, id as number), eq(schema.contacts.salesId, salesId)))
        .groupBy(schema.contacts.id, schema.companies.name)
        .limit(1);
      if (!row) return c.json({ error: "Not found" }, 404);
      return c.json(row);
    }

    const table = TABLE_MAP[resource as Exclude<Resource, "companies_summary" | "contacts_summary">];
    if (!table) return c.json({ error: "Unknown resource" }, 404);

    const idCol = (table as { id: typeof schema.contacts.id }).id;
    const conditions: SQL[] = [eq(idCol, id)];
    if (resource === "sales") {
      if (orgId) conditions.push(eq(schema.sales.organizationId, orgId));
    } else if (hasSalesId(resource)) {
      conditions.push(eq((table as typeof schema.companies).salesId, salesId));
    }

    const [row] = await db.select().from(table).where(and(...conditions)).limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(row);
  });

  app.post("/:resource", async (c) => {
    const resource = c.req.param("resource") as Resource;
    if (!CRM_RESOURCES.includes(resource) || resource.endsWith("_summary")) {
      return c.json({ error: "Cannot create on this resource" }, 400);
    }

    const session = c.get("session") as { user?: { id: string } };
    const salesRow = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);
    const salesId = salesRow[0]?.id;
    if (!salesId) return c.json({ error: "User not found in CRM" }, 404);

    const rawBody = (await c.req.json()) as Record<string, unknown>;
    const table = TABLE_MAP[resource as Exclude<Resource, "companies_summary" | "contacts_summary">];
    if (!table) return c.json({ error: "Unknown resource" }, 404);

    const body = snakeToCamel(rawBody) as Record<string, unknown>;
    if (hasSalesId(resource)) {
      body.salesId = salesId;
    }

    const [inserted] = await db.insert(table).values(body).returning();
    if (!inserted) return c.json({ error: "Insert failed" }, 500);

    // Fire-and-forget: generate and store embedding for searchable entities
    const entityType = getEntityType(resource);
    const apiKey = salesRow[0]?.basicsApiKey;
    if (entityType && apiKey && inserted && typeof (inserted as { id?: unknown }).id === "number") {
      const chunkText = buildEntityText(entityType, inserted as Record<string, unknown>);
      upsertEntityEmbedding(db, env.BASICOS_API_URL, apiKey, salesId, entityType, (inserted as { id: number }).id, chunkText).catch(() => {});
    }

    // Fire-and-forget: trigger automations
    const eventResource = ["deals", "contacts", "tasks"].includes(resource) ? resource : null;
    if (eventResource) {
      fireEvent(`${eventResource.replace(/s$/, "")}.created`, inserted as Record<string, unknown>, salesId).catch(() => {});
    }

    return c.json(inserted, 201);
  });

  app.put("/:resource/:id", async (c) => {
    const resource = c.req.param("resource") as Resource;
    const idRaw = c.req.param("id");
    const id = resource === "configuration" ? 1 : parseInt(idRaw, 10);
    if ((resource !== "configuration" && isNaN(id as number)) || !CRM_RESOURCES.includes(resource) || resource.endsWith("_summary")) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const session = c.get("session") as { user?: { id: string } };
    const salesRow = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);
    const salesId = salesRow[0]?.id;
    const orgId = salesRow[0]?.organizationId;
    if (!salesId) return c.json({ error: "User not found in CRM" }, 404);

    const rawBody = (await c.req.json()) as Record<string, unknown>;
    delete rawBody.id;
    const body = snakeToCamel(rawBody) as Record<string, unknown>;

    const table = TABLE_MAP[resource as Exclude<Resource, "companies_summary" | "contacts_summary">];
    if (!table) return c.json({ error: "Unknown resource" }, 404);

    const idCol = (table as { id: typeof schema.contacts.id }).id;
    const conditions: SQL[] = [eq(idCol, id)];
    if (resource === "sales") {
      if (orgId) conditions.push(eq(schema.sales.organizationId, orgId));
    } else if (hasSalesId(resource)) {
      conditions.push(eq((table as typeof schema.companies).salesId, salesId));
    }

    const [updated] = await db.update(table).set(body).where(and(...conditions)).returning();
    if (!updated) return c.json({ error: "Not found" }, 404);

    // Fire-and-forget: refresh embedding for updated entity
    const entityTypeU = getEntityType(resource);
    const apiKeyU = salesRow[0]?.basicsApiKey;
    if (entityTypeU && apiKeyU && typeof id === "number") {
      const chunkText = buildEntityText(entityTypeU, updated as Record<string, unknown>);
      upsertEntityEmbedding(db, env.BASICOS_API_URL, apiKeyU, salesId, entityTypeU, id, chunkText).catch(() => {});
    }

    // Fire-and-forget: trigger automations
    const eventResourceU = ["deals", "contacts", "tasks"].includes(resource) ? resource : null;
    if (eventResourceU) {
      fireEvent(`${eventResourceU.replace(/s$/, "")}.updated`, updated as Record<string, unknown>, salesId).catch(() => {});
    }

    // When automation rule is updated, reload its schedule (if it has a schedule trigger)
    if (resource === "automation_rules" && typeof id === "number") {
      reloadRule(id).catch(() => {});
    }

    return c.json(updated);
  });

  app.delete("/:resource/:id", async (c) => {
    const resource = c.req.param("resource") as Resource;
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id) || !CRM_RESOURCES.includes(resource) || resource.endsWith("_summary")) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const session = c.get("session") as { user?: { id: string } };
    const salesRow = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);
    const salesId = salesRow[0]?.id;
    const orgId = salesRow[0]?.organizationId;
    if (!salesId) return c.json({ error: "User not found in CRM" }, 404);

    const table = TABLE_MAP[resource as Exclude<Resource, "companies_summary" | "contacts_summary">];
    if (!table) return c.json({ error: "Unknown resource" }, 404);

    const idCol = (table as { id: typeof schema.contacts.id }).id;
    const conditions: SQL[] = [eq(idCol, id)];
    if (resource === "sales") {
      if (orgId) conditions.push(eq(schema.sales.organizationId, orgId));
    } else if (hasSalesId(resource)) {
      conditions.push(eq((table as typeof schema.companies).salesId, salesId));
    }

    const [deleted] = await db.delete(table).where(and(...conditions)).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);

    // Remove embedding for deleted entity
    const entityTypeDel = getEntityType(resource);
    if (entityTypeDel) {
      deleteEntityEmbedding(db, salesId, entityTypeDel, id).catch(() => {});
    }

    // Fire-and-forget: trigger automations
    const eventResourceDel = ["deals", "contacts", "tasks"].includes(resource) ? resource : null;
    if (eventResourceDel) {
      fireEvent(`${eventResourceDel.replace(/s$/, "")}.deleted`, deleted as Record<string, unknown>, salesId).catch(() => {});
    }

    return c.json(deleted);
  });

  return app;
}
