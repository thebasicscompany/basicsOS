import * as schema from "../../../db/schema/index.js";
import { eq, and } from "drizzle-orm";
import { getEntityType, deleteEntityEmbedding } from "../../../lib/embeddings.js";
import { fireEvent } from "../../../lib/automation-engine.js";
import { CRM_RESOURCES, TABLE_MAP, hasOrganizationId } from "../constants.js";
import { PERMISSIONS, getPermissionSetForUser } from "../../../lib/rbac.js";
export function createDeleteHandler(db) {
    return async (c) => {
        const resource = c.req.param("resource");
        const id = parseInt(c.req.param("id"), 10);
        if (isNaN(id) || !CRM_RESOURCES.includes(resource) || resource.endsWith("_summary")) {
            return c.json({ error: "Invalid request" }, 400);
        }
        const session = c.get("session");
        const crmUserRows = await db
            .select()
            .from(schema.crmUsers)
            .where(eq(schema.crmUsers.userId, session.user.id))
            .limit(1);
        const crmUser = crmUserRows[0];
        const crmUserId = crmUser?.id;
        const orgId = crmUser?.organizationId;
        if (!crmUserId || !crmUser)
            return c.json({ error: "User not found in CRM" }, 404);
        if (!orgId)
            return c.json({ error: "Organization not found" }, 404);
        const permissions = await getPermissionSetForUser(db, crmUser);
        const canHardDelete = permissions.has("*") || permissions.has(PERMISSIONS.recordsDeleteHard);
        const canArchive = permissions.has("*") || permissions.has(PERMISSIONS.recordsArchive);
        const table = TABLE_MAP[resource];
        if (!table)
            return c.json({ error: "Unknown resource" }, 404);
        const idCol = table.id;
        const conditions = [eq(idCol, id)];
        if (resource === "crm_users") {
            conditions.push(eq(schema.crmUsers.organizationId, orgId));
        }
        else if (hasOrganizationId(resource)) {
            conditions.push(eq(table.organizationId, orgId));
        }
        // Non-admin users can only archive deals; hard delete is admin-only.
        if (!canHardDelete) {
            if (resource !== "deals" || !canArchive) {
                return c.json({ error: "Forbidden" }, 403);
            }
            const [archived] = await db
                .update(schema.deals)
                .set({ archivedAt: new Date(), updatedAt: new Date() })
                .where(and(eq(schema.deals.id, id), eq(schema.deals.organizationId, orgId)))
                .returning();
            if (!archived)
                return c.json({ error: "Not found" }, 404);
            return c.json({ archived: true, record: archived });
        }
        const [deleted] = await db.delete(table).where(and(...conditions)).returning();
        if (!deleted)
            return c.json({ error: "Not found" }, 404);
        const entityTypeDel = getEntityType(resource);
        if (entityTypeDel) {
            deleteEntityEmbedding(db, crmUserId, entityTypeDel, id).catch(() => { });
        }
        const eventResourceDel = ["deals", "contacts", "tasks"].includes(resource) ? resource : null;
        if (eventResourceDel) {
            fireEvent(`${eventResourceDel.replace(/s$/, "")}.deleted`, deleted, crmUserId).catch(() => { });
        }
        return c.json(deleted);
    };
}
