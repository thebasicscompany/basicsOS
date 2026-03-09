import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { and, eq } from "drizzle-orm";
import {
  TABLE_MAP,
  hasOrganizationId,
  type Resource,
} from "@/routes/crm/constants.js";

export interface DeleteParams {
  resource: Resource;
  id: number;
  orgId: string;
}

export interface ArchiveResult {
  archived: true;
  record: Record<string, unknown>;
}

export interface HardDeleteResult {
  record: Record<string, unknown>;
}

export async function archiveDeal(
  db: Db,
  params: { id: number; orgId: string },
): Promise<Record<string, unknown> | null> {
  const { id, orgId } = params;
  const [archived] = await db
    .update(schema.deals)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.deals.id, id), eq(schema.deals.organizationId, orgId)))
    .returning();
  return (archived as Record<string, unknown>) ?? null;
}

export async function hardDeleteRecord(
  db: Db,
  params: DeleteParams,
): Promise<Record<string, unknown> | null> {
  const { resource, id, orgId } = params;

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

  const [deleted] = await db
    .delete(table)
    .where(and(...conditions))
    .returning();
  return (deleted as Record<string, unknown>) ?? null;
}
