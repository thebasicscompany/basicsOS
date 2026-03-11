import { PERMISSIONS, requirePermission } from "../../../lib/rbac.js";
import { mergeContacts } from "../../../data-access/crm/merge-contacts.js";
import { mergeContactsBodySchema } from "../../../schemas/crm/merge-contacts.js";
export function createMergeContactsHandler(db) {
    return async (c) => {
        let rawBody;
        try {
            rawBody = await c.req.json();
        }
        catch {
            return c.json({ error: "Invalid JSON body" }, 400);
        }
        const parsed = mergeContactsBodySchema.safeParse(rawBody);
        if (!parsed.success) {
            return c.json({ error: "loserId and winnerId required" }, 400);
        }
        const { loserId, winnerId } = parsed.data;
        const authz = await requirePermission(c, db, PERMISSIONS.recordsMerge);
        if (!authz.ok)
            return authz.response;
        const { crmUser } = authz;
        const orgId = crmUser.organizationId;
        if (!orgId)
            return c.json({ error: "Organization not found" }, 404);
        try {
            await mergeContacts(db, { loserId, winnerId, orgId });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Contact not found";
            return c.json({ error: msg }, 404);
        }
        return c.json({ id: winnerId });
    };
}
