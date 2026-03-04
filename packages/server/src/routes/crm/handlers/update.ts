import type { Context } from "hono";
import type { Db } from "../../../db/client.js";
import type { Env } from "../../../env.js";
import * as schema from "../../../db/schema/index.js";
import { eq, and } from "drizzle-orm";
import {
  buildEntityText,
  getEntityType,
  upsertEntityEmbedding,
} from "../../../lib/embeddings.js";
import { fireEvent, reloadRule } from "../../../lib/automation-engine.js";
import {
  CRM_RESOURCES,
  TABLE_MAP,
  hasOrganizationId,
  type Resource,
} from "../constants.js";
import { snakeToCamel } from "../utils.js";
import { PERMISSIONS, getPermissionSetForUser } from "../../../lib/rbac.js";
import { getWriteAllowlist } from "./field-allowlists.js";
import { resolveStoredApiKey } from "../../../lib/api-key-crypto.js";
import { validateWritePayload } from "./payload-schemas.js";

export function createUpdateHandler(db: Db, env: Env) {
  return async (c: Context) => {
    const resource = c.req.param("resource") as Resource;
    const idRaw = c.req.param("id");
    const id = resource === "configuration" ? 1 : parseInt(idRaw, 10);
    if (
      (resource !== "configuration" && isNaN(id as number)) ||
      !CRM_RESOURCES.includes(resource) ||
      resource.endsWith("_summary")
    ) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const session = c.get("session") as { user?: { id: string } };
    const crmUserRows = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, session.user!.id))
      .limit(1);
    const crmUser = crmUserRows[0];
    const crmUserId = crmUser?.id;
    const orgId = crmUser?.organizationId;
    if (!crmUserId || !crmUser) return c.json({ error: "User not found in CRM" }, 404);
    if (!orgId) return c.json({ error: "Organization not found" }, 404);
    const permissions = await getPermissionSetForUser(db, crmUser);
    if (!permissions.has("*") && !permissions.has(PERMISSIONS.recordsWrite)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (resource === "crm_users" && !permissions.has("*")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const rawBody = (await c.req.json()) as Record<string, unknown>;
    delete rawBody.id;
    const bodyRaw = snakeToCamel(rawBody) as Record<string, unknown>;
    const validated = validateWritePayload(resource, "update", bodyRaw);
    if (!validated.success) return c.json({ error: validated.error }, 400);

    const allowedFields = getWriteAllowlist(resource);
    if (allowedFields.size === 0) {
      return c.json({ error: "Update not supported for this resource" }, 400);
    }
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(validated.data)) {
      if (allowedFields.has(key)) body[key] = value;
    }

    if (Object.keys(body).length === 0) {
      return c.json({ error: "No writable fields to update" }, 400);
    }

    const table = TABLE_MAP[resource as Exclude<Resource, "companies_summary" | "contacts_summary">];
    if (!table) return c.json({ error: "Unknown resource" }, 404);

    const idCol = (table as unknown as { id: typeof schema.contacts.id }).id;
    const conditions = [eq(idCol, id)];
    if (resource === "crm_users") {
      conditions.push(eq(schema.crmUsers.organizationId, orgId));
    } else if (hasOrganizationId(resource)) {
      conditions.push(eq((table as typeof schema.companies).organizationId, orgId));
    }
    const [updated] = await db.update(table).set(body).where(and(...conditions)).returning();
    if (!updated) return c.json({ error: "Not found" }, 404);

    const entityTypeU = getEntityType(resource);
    const apiKeyU = resolveStoredApiKey(crmUserRows[0] ?? {});
    if (entityTypeU && apiKeyU && typeof id === "number") {
      const chunkText = buildEntityText(entityTypeU, updated as Record<string, unknown>);
      upsertEntityEmbedding(db, env.BASICOS_API_URL, apiKeyU, crmUserId, entityTypeU, id, chunkText).catch(() => {});
    }

    const eventResourceU = ["deals", "contacts", "tasks"].includes(resource) ? resource : null;
    if (eventResourceU) {
      fireEvent(`${eventResourceU.replace(/s$/, "")}.updated`, updated as Record<string, unknown>, crmUserId).catch(() => {});
    }

    if (resource === "automation_rules" && typeof id === "number") {
      reloadRule(id).catch(() => {});
    }

    return c.json(updated);
  };
}
