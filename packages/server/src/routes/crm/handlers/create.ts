import type { Context } from "hono";
import type { Db } from "../../../db/client.js";
import type { Env } from "../../../env.js";
import * as schema from "../../../db/schema/index.js";
import { eq } from "drizzle-orm";
import {
  buildEntityText,
  getEntityType,
  upsertEntityEmbedding,
} from "../../../lib/embeddings.js";
import { fireEvent, reloadRule } from "../../../lib/automation-engine.js";
import {
  CRM_RESOURCES,
  TABLE_MAP,
  hasCrmUserId,
  hasOrganizationId,
  type Resource,
} from "../constants.js";
import { snakeToCamel } from "../utils.js";
import { PERMISSIONS, getPermissionSetForUser } from "../../../lib/rbac.js";
import { getWriteAllowlist } from "./field-allowlists.js";
import { resolveStoredApiKey } from "../../../lib/api-key-crypto.js";

export function createCreateHandler(db: Db, env: Env) {
  return async (c: Context) => {
    const resource = c.req.param("resource") as Resource;
    if (!CRM_RESOURCES.includes(resource) || resource.endsWith("_summary")) {
      return c.json({ error: "Cannot create on this resource" }, 400);
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
    const table = TABLE_MAP[resource as Exclude<Resource, "companies_summary" | "contacts_summary">];
    if (!table) return c.json({ error: "Unknown resource" }, 404);

    const bodyRaw = snakeToCamel(rawBody) as Record<string, unknown>;
    const allowedFields = getWriteAllowlist(resource);
    if (allowedFields.size === 0) {
      return c.json({ error: "Create not supported for this resource" }, 400);
    }
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(bodyRaw)) {
      if (allowedFields.has(key)) body[key] = value;
    }
    if (Object.keys(body).length === 0) {
      return c.json({ error: "No writable fields provided" }, 400);
    }

    if (hasCrmUserId(resource)) {
      body.crmUserId = crmUserId;
    }
    if (hasOrganizationId(resource)) {
      body.organizationId = orgId;
    }

    const [inserted] = await db.insert(table).values(body).returning();
    if (!inserted) return c.json({ error: "Insert failed" }, 500);

    const entityType = getEntityType(resource);
    const apiKey = resolveStoredApiKey(crmUserRows[0] ?? {});
    if (entityType && apiKey && inserted && typeof (inserted as { id?: unknown }).id === "number") {
      const chunkText = buildEntityText(entityType, inserted as Record<string, unknown>);
      upsertEntityEmbedding(db, env.BASICOS_API_URL, apiKey, crmUserId, entityType, (inserted as { id: number }).id, chunkText).catch(() => {});
    }

    const eventResource = ["deals", "contacts", "tasks"].includes(resource) ? resource : null;
    if (eventResource) {
      fireEvent(`${eventResource.replace(/s$/, "")}.created`, inserted as Record<string, unknown>, crmUserId).catch(() => {});
    }

    if (resource === "automation_rules" && typeof (inserted as { id?: number }).id === "number") {
      reloadRule((inserted as { id: number }).id).catch(() => {});
    }

    return c.json(inserted, 201);
  };
}
