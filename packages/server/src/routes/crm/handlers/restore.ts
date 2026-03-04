import type { Context } from "hono";
import type { Db } from "../../../db/client.js";
import * as schema from "../../../db/schema/index.js";
import { and, eq } from "drizzle-orm";
import type { Resource } from "../constants.js";
import { PERMISSIONS, getPermissionSetForUser } from "../../../lib/rbac.js";
import { writeAuditLogSafe } from "../../../lib/audit-log.js";

export function createRestoreHandler(db: Db) {
  return async (c: Context) => {
    const resource = c.req.param("resource") as Resource;
    if (resource !== "deals") {
      return c.json({ error: "Restore is only supported for deals" }, 400);
    }

    const id = parseInt(c.req.param("id"), 10);
    if (Number.isNaN(id)) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const session = c.get("session") as { user?: { id: string } };
    const [crmUser] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, session.user!.id))
      .limit(1);
    if (!crmUser) return c.json({ error: "User not found in CRM" }, 404);
    if (!crmUser.organizationId) return c.json({ error: "Organization not found" }, 404);
    const permissions = await getPermissionSetForUser(db, crmUser);
    if (
      !permissions.has("*") &&
      !permissions.has(PERMISSIONS.recordsRestore)
    ) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const [restored] = await db
      .update(schema.deals)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(schema.deals.id, id), eq(schema.deals.organizationId, crmUser.organizationId)))
      .returning();

    if (!restored) return c.json({ error: "Not found" }, 404);
    await writeAuditLogSafe(db, {
      crmUserId: crmUser.id,
      organizationId: crmUser.organizationId,
      action: "crm.record.restored",
      entityType: "deals",
      entityId: id,
    });
    return c.json(restored);
  };
}
