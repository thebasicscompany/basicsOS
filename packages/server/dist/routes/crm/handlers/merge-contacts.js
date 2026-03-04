import * as schema from "../../../db/schema/index.js";
import { eq, and } from "drizzle-orm";
import { PERMISSIONS, getPermissionSetForUser } from "../../../lib/rbac.js";
export function createMergeContactsHandler(db) {
    return async (c) => {
        const body = await c.req.json();
        const { loserId, winnerId } = body;
        if (!loserId || !winnerId) {
            return c.json({ error: "loserId and winnerId required" }, 400);
        }
        const session = c.get("session");
        const crmUserRows = await db
            .select()
            .from(schema.crmUsers)
            .where(eq(schema.crmUsers.userId, session.user.id))
            .limit(1);
        const crmUser = crmUserRows[0];
        const orgId = crmUser?.organizationId;
        if (!crmUser)
            return c.json({ error: "User not found in CRM" }, 404);
        if (!orgId)
            return c.json({ error: "Organization not found" }, 404);
        const permissions = await getPermissionSetForUser(db, crmUser);
        if (!permissions.has("*") && !permissions.has(PERMISSIONS.recordsMerge)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const [loser] = await db
            .select()
            .from(schema.contacts)
            .where(and(eq(schema.contacts.id, loserId), eq(schema.contacts.organizationId, orgId)))
            .limit(1);
        const [winner] = await db
            .select()
            .from(schema.contacts)
            .where(and(eq(schema.contacts.id, winnerId), eq(schema.contacts.organizationId, orgId)))
            .limit(1);
        if (!loser || !winner)
            return c.json({ error: "Contact not found" }, 404);
        await db.update(schema.tasks).set({ contactId: winnerId }).where(eq(schema.tasks.contactId, loserId));
        await db.update(schema.contactNotes).set({ contactId: winnerId }).where(eq(schema.contactNotes.contactId, loserId));
        const allDeals = await db.select().from(schema.deals).where(eq(schema.deals.organizationId, orgId));
        for (const deal of allDeals) {
            const ids = deal.contactIds ?? [];
            if (ids.includes(loserId)) {
                const next = ids.filter((x) => x !== loserId);
                if (!next.includes(winnerId))
                    next.push(winnerId);
                await db.update(schema.deals).set({ contactIds: next }).where(eq(schema.deals.id, deal.id));
            }
        }
        await db
            .delete(schema.contacts)
            .where(and(eq(schema.contacts.id, loserId), eq(schema.contacts.organizationId, orgId)));
        return c.json({ id: winnerId });
    };
}
