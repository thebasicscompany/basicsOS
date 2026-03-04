import * as schema from "../../../db/schema/index.js";
import { eq } from "drizzle-orm";
import { buildEntityText, getEntityType, upsertEntityEmbedding, } from "../../../lib/embeddings.js";
import { fireEvent, reloadRule } from "../../../lib/automation-engine.js";
import { CRM_RESOURCES, TABLE_MAP, hasCrmUserId, hasOrganizationId, } from "../constants.js";
import { snakeToCamel } from "../utils.js";
import { PERMISSIONS, getPermissionSetForUser } from "../../../lib/rbac.js";
export function createCreateHandler(db, env) {
    return async (c) => {
        const resource = c.req.param("resource");
        if (!CRM_RESOURCES.includes(resource) || resource.endsWith("_summary")) {
            return c.json({ error: "Cannot create on this resource" }, 400);
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
        const table = TABLE_MAP[resource];
        if (!table)
            return c.json({ error: "Unknown resource" }, 404);
        const body = snakeToCamel(rawBody);
        if (hasCrmUserId(resource)) {
            body.crmUserId = crmUserId;
        }
        if (hasOrganizationId(resource)) {
            body.organizationId = orgId;
        }
        const [inserted] = await db.insert(table).values(body).returning();
        if (!inserted)
            return c.json({ error: "Insert failed" }, 500);
        const entityType = getEntityType(resource);
        const apiKey = crmUserRows[0]?.basicsApiKey;
        if (entityType && apiKey && inserted && typeof inserted.id === "number") {
            const chunkText = buildEntityText(entityType, inserted);
            upsertEntityEmbedding(db, env.BASICOS_API_URL, apiKey, crmUserId, entityType, inserted.id, chunkText).catch(() => { });
        }
        const eventResource = ["deals", "contacts", "tasks"].includes(resource) ? resource : null;
        if (eventResource) {
            fireEvent(`${eventResource.replace(/s$/, "")}.created`, inserted, crmUserId).catch(() => { });
        }
        if (resource === "automation_rules" && typeof inserted.id === "number") {
            reloadRule(inserted.id).catch(() => { });
        }
        return c.json(inserted, 201);
    };
}
