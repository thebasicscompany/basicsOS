import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { eq, and } from "drizzle-orm";

export interface MergeContactsParams {
  loserId: number;
  winnerId: number;
  orgId: string;
}

export async function mergeContacts(
  db: Db,
  params: MergeContactsParams,
): Promise<void> {
  const { loserId, winnerId, orgId } = params;

  await db.transaction(async (tx) => {
    const [loser] = await tx
      .select()
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.id, loserId),
          eq(schema.contacts.organizationId, orgId),
        ),
      )
      .limit(1);
    const [winner] = await tx
      .select()
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.id, winnerId),
          eq(schema.contacts.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!loser || !winner) throw new Error("Contact not found");

    await tx
      .update(schema.tasks)
      .set({ contactId: winnerId })
      .where(eq(schema.tasks.contactId, loserId));
    await tx
      .update(schema.contactNotes)
      .set({ contactId: winnerId })
      .where(eq(schema.contactNotes.contactId, loserId));

    await tx
      .delete(schema.contacts)
      .where(
        and(
          eq(schema.contacts.id, loserId),
          eq(schema.contacts.organizationId, orgId),
        ),
      );
  });
}
