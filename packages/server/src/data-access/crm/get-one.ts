import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { eq, and, sql } from "drizzle-orm";
import {
  TABLE_MAP,
  hasOrganizationId,
  type Resource,
} from "@/routes/crm/constants.js";

export interface GetOneParams {
  resource: Resource;
  id: number;
  orgId: string;
}

export async function getOneRecord(
  db: Db,
  params: GetOneParams,
): Promise<unknown | null> {
  const { resource, id, orgId } = params;

  if (resource === "companies_summary") {
    const [row] = await db
      // @ts-expect-error - Drizzle SelectedFields typing with spread table + agg
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
      .where(
        and(
          eq(schema.companies.id, id),
          eq(schema.companies.organizationId, orgId),
        ),
      )
      .groupBy(schema.companies.id)
      .limit(1);
    return row ?? null;
  }

  if (resource === "contacts_summary") {
    const [row] = await db
      // @ts-expect-error - Drizzle SelectedFields typing with spread table + joined cols
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
      .where(
        and(
          eq(schema.contacts.id, id),
          eq(schema.contacts.organizationId, orgId),
        ),
      )
      .groupBy(schema.contacts.id, schema.companies.name)
      .limit(1);
    return row ?? null;
  }

  const table =
    TABLE_MAP[
      resource as Exclude<Resource, "companies_summary" | "contacts_summary">
    ];
  if (!table) throw new Error("Unknown resource");

  const idCol = (table as unknown as { id: typeof schema.contacts.id }).id;
  const conditions = [eq(idCol, id)];
  if (resource === "crm_users") {
    conditions.push(eq(schema.crmUsers.organizationId, orgId));
  } else if (hasOrganizationId(resource)) {
    conditions.push(
      eq((table as typeof schema.companies).organizationId, orgId),
    );
  }
  if (resource === "deals") {
    conditions.push(sql`${schema.deals.archivedAt} is null`);
  }

  const [row] = await db
    .select()
    .from(table)
    .where(and(...conditions))
    .limit(1);
  return row ?? null;
}
