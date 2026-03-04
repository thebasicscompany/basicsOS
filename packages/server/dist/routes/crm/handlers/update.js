import * as schema from "../../../db/schema/index.js";
import { eq, and } from "drizzle-orm";
import { buildEntityText, getEntityType, upsertEntityEmbedding, } from "../../../lib/embeddings.js";
import { fireEvent, reloadRule } from "../../../lib/automation-engine.js";
import { CRM_RESOURCES, TABLE_MAP, hasOrganizationId, } from "../constants.js";
import { snakeToCamel } from "../utils.js";
import { PERMISSIONS, getPermissionSetForUser } from "../../../lib/rbac.js";
export function createUpdateHandler(db, env) {
    return async (c) => {
        const resource = c.req.param("resource");
        const idRaw = c.req.param("id");
        const id = resource === "configuration" ? 1 : parseInt(idRaw, 10);
        if ((resource !== "configuration" && isNaN(id)) ||
            !CRM_RESOURCES.includes(resource) ||
            resource.endsWith("_summary")) {
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
        if (!permissions.has("*") && !permissions.has(PERMISSIONS.recordsWrite)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        if (resource === "crm_users" && !permissions.has("*")) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const rawBody = (await c.req.json());
        delete rawBody.id;
        const body = snakeToCamel(rawBody);
        if (Object.keys(body).length === 0) {
            return c.json({ error: "No fields to update; request body is empty after removing id" }, 400);
        }
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
        const [updated] = await db.update(table).set(body).where(and(...conditions)).returning();
        if (!updated)
            return c.json({ error: "Not found" }, 404);
        const entityTypeU = getEntityType(resource);
        const apiKeyU = crmUserRows[0]?.basicsApiKey;
        if (entityTypeU && apiKeyU && typeof id === "number") {
            const chunkText = buildEntityText(entityTypeU, updated);
            upsertEntityEmbedding(db, env.BASICOS_API_URL, apiKeyU, crmUserId, entityTypeU, id, chunkText).catch(() => { });
        }
        const eventResourceU = ["deals", "contacts", "tasks"].includes(resource) ? resource : null;
        if (eventResourceU) {
            fireEvent(`${eventResourceU.replace(/s$/, "")}.updated`, updated, crmUserId).catch(() => { });
        }
        if (resource === "automation_rules" && typeof id === "number") {
            reloadRule(id).catch(() => { });
        }
        return c.json(updated);
    };
}
