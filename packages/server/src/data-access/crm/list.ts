import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { eq, and, or, ilike, sql, desc, asc, type SQL } from "drizzle-orm";
import {
  CRM_RESOURCES,
  TABLE_MAP,
  hasOrganizationId,
  type Resource,
} from "@/routes/crm/constants.js";
import {
  snakeToCamelField,
  buildGenericFilterCondition,
  type GenericFilter,
} from "@/data-access/crm/utils.js";

export interface ListParams {
  resource: Resource;
  orgId: string;
  start: number;
  end: number;
  sorts: Array<{ field: string; order: "ASC" | "DESC" }>;
  filter: Record<string, unknown>;
  genericFilters: GenericFilter[];
}

export interface ListResult {
  rows: unknown[];
  total: number;
}

function buildGenericFilterExpression(
  table: typeof schema.companies,
  genericFilters: GenericFilter[],
): SQL | null {
  let expression: SQL | null = null;

  for (const gf of genericFilters) {
    const cond = buildGenericFilterCondition(table, gf);
    if (!cond) continue;

    if (!expression) {
      expression = cond;
      continue;
    }

    expression =
      (gf.logicalOp === "or" ? or(expression, cond) : and(expression, cond)) ??
      null;
  }

  return expression;
}

function buildOrderByExpression(
  table: typeof schema.companies,
  sort: { field: string; order: "ASC" | "DESC" },
): SQL | null {
  const sortParamCamel = snakeToCamelField(sort.field);
  const orderByCol = (table as unknown as Record<string, unknown>)[
    sortParamCamel
  ];
  const orderDir = sort.order === "DESC" ? desc : asc;

  if (orderByCol) {
    return orderDir(orderByCol as SQL);
  }

  const customFieldsColumn = (table as unknown as Record<string, unknown>)
    .customFields;
  if (
    customFieldsColumn &&
    typeof (customFieldsColumn as { getSQL?: unknown }).getSQL === "function"
  ) {
    return orderDir(sql`(${customFieldsColumn as SQL} ->> ${sort.field})`);
  }

  return null;
}

export async function listRecords(
  db: Db,
  params: ListParams,
): Promise<ListResult> {
  const { resource, orgId, start, end, filter, genericFilters, sorts } = params;
  const limit = Math.max(0, end - start + 1);
  const offset = start;
  const q = typeof filter.q === "string" ? filter.q.trim() : null;

  if (resource === "companies_summary") {
    const companyConds: SQL[] = [eq(schema.companies.organizationId, orgId)];
    if (q) {
      companyConds.push(
        or(
          ilike(schema.companies.name, `%${q}%`),
          ilike(schema.companies.category, `%${q}%`),
        ) as SQL,
      );
    }
    if (filter.category)
      companyConds.push(
        eq(schema.companies.category, filter.category as string),
      );

    const rows = await db
      // @ts-expect-error - SelectedFields typing with spread + SQL aliased
      .select({
        ...schema.companies,
        nbDeals: sql<number>`count(distinct ${schema.deals.id})::int`.as(
          "nb_deals",
        ),
        nbContacts: sql<number>`count(distinct ${schema.contacts.id})::int`.as(
          "nb_contacts",
        ),
      })
      .from(schema.companies)
      .leftJoin(schema.deals, eq(schema.companies.id, schema.deals.companyId))
      .leftJoin(
        schema.contacts,
        eq(schema.companies.id, schema.contacts.companyId),
      )
      .where(and(...companyConds))
      .groupBy(schema.companies.id)
      .limit(limit)
      .offset(offset);

    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.companies)
      .where(and(...companyConds));

    return { rows, total };
  }

  if (resource === "contacts_summary") {
    const contactConds: SQL[] = [eq(schema.contacts.organizationId, orgId)];
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
    if (filter.company_id) {
      contactConds.push(
        eq(schema.contacts.companyId, Number(filter.company_id)),
      );
    }

    const rows = await db
      // @ts-expect-error - SelectedFields typing doesn't accept spread table + joined cols
      .select({
        ...schema.contacts,
        companyName: schema.companies.name,
        nbTasks: sql<number>`count(distinct ${schema.tasks.id})::int`.as(
          "nb_tasks",
        ),
      })
      .from(schema.contacts)
      .leftJoin(schema.tasks, eq(schema.contacts.id, schema.tasks.contactId))
      .leftJoin(
        schema.companies,
        eq(schema.contacts.companyId, schema.companies.id),
      )
      .where(and(...contactConds))
      .groupBy(schema.contacts.id, schema.companies.name)
      .limit(limit)
      .offset(offset);

    const countRows = await db
      .select({
        count: sql<number>`count(distinct ${schema.contacts.id})::int`,
      })
      .from(schema.contacts)
      .leftJoin(
        schema.companies,
        eq(schema.contacts.companyId, schema.companies.id),
      )
      .where(and(...contactConds));
    const total = countRows[0]?.count ?? 0;

    return { rows, total };
  }

  const table =
    TABLE_MAP[
      resource as Exclude<Resource, "companies_summary" | "contacts_summary">
    ];
  if (!table) throw new Error("Unknown resource");

  const conditions: SQL[] = [];
  if (resource === "crm_users") {
    conditions.push(eq(schema.crmUsers.organizationId, orgId));
  } else if (hasOrganizationId(resource)) {
    conditions.push(
      eq((table as typeof schema.companies).organizationId, orgId),
    );
  }

  if (resource === "companies" && q) {
    conditions.push(
      or(
        ilike(schema.companies.name, `%${q}%`),
        ilike(schema.companies.category, `%${q}%`),
      ) as SQL,
    );
  }
  if (resource === "deals") {
    const includeArchived = filter.include_archived === true;
    if (!includeArchived)
      conditions.push(sql`${schema.deals.archivedAt} is null`);
    if (q) conditions.push(ilike(schema.deals.name, `%${q}%`));
    if (filter.status)
      conditions.push(eq(schema.deals.status, filter.status as string));
    if (filter.company_id)
      conditions.push(eq(schema.deals.companyId, Number(filter.company_id)));
  }
  if (resource === "tasks" && filter.contact_id != null) {
    conditions.push(eq(schema.tasks.contactId, Number(filter.contact_id)));
  }
  if (resource === "contact_notes" && filter.contact_id != null) {
    conditions.push(
      eq(schema.contactNotes.contactId, Number(filter.contact_id)),
    );
  }
  if (resource === "deal_notes" && filter.deal_id != null) {
    conditions.push(eq(schema.dealNotes.dealId, Number(filter.deal_id)));
  }
  if (resource === "company_notes" && filter.company_id != null) {
    conditions.push(
      eq(schema.companyNotes.companyId, Number(filter.company_id)),
    );
  }

  const genericExpression = buildGenericFilterExpression(
    table as typeof schema.companies,
    genericFilters,
  );
  if (genericExpression) {
    conditions.push(genericExpression);
  }

  const orderByExpressions = sorts
    .map((sort) =>
      buildOrderByExpression(table as typeof schema.companies, sort),
    )
    .filter((expr): expr is SQL => expr !== null);

  const countResult = await (conditions.length > 0
    ? db
        .select({ count: sql<number>`count(*)::int` })
        .from(table)
        .where(and(...conditions))
    : db.select({ count: sql<number>`count(*)::int` }).from(table));
  const total = countResult[0]?.count ?? 0;

  const baseQuery =
    conditions.length > 0
      ? db
          .select()
          .from(table)
          .where(and(...conditions))
      : db.select().from(table);
  const finalQuery =
    orderByExpressions.length > 0
      ? baseQuery.orderBy(...orderByExpressions)
      : baseQuery;
  const rows = await finalQuery.limit(limit).offset(offset);

  return { rows, total };
}

export function isListableResource(resource: string): resource is Resource {
  return CRM_RESOURCES.includes(resource as Resource);
}
