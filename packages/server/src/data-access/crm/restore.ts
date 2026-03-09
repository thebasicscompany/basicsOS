import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { and, eq } from "drizzle-orm";

export interface RestoreParams {
  id: number;
  orgId: string;
}

export async function restoreDeal(
  db: Db,
  params: RestoreParams,
): Promise<Record<string, unknown> | null> {
  const { id, orgId } = params;

  const [restored] = await db
    .update(schema.deals)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(schema.deals.id, id), eq(schema.deals.organizationId, orgId)))
    .returning();

  return (restored as Record<string, unknown>) ?? null;
}
