import type { Context } from "hono";
import type { Db } from "@/db/client.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { getOneRecord } from "@/data-access/crm/get-one.js";
import { CRM_RESOURCES, type Resource } from "@/routes/crm/constants.js";
import {
  resolveCustomTable,
  getCustomRecord,
} from "@/data-access/crm/dynamic-table.js";

export function createGetOneHandler(db: Db) {
  return async (c: Context) => {
    const resource = c.req.param("resource") as Resource;
    const idRaw = c.req.param("id");
    const id = resource === "configuration" ? 1 : parseInt(idRaw, 10);

    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const { crmUser } = authz;
    const orgId = crmUser.organizationId;
    if (!orgId) return c.json({ error: "Organization not found" }, 404);

    // Try custom table if not a built-in resource
    if (!CRM_RESOURCES.includes(resource)) {
      if (isNaN(id as number)) return c.json({ error: "Invalid request" }, 400);
      const customTable = await resolveCustomTable(db, resource, orgId);
      if (!customTable) return c.json({ error: "Unknown resource" }, 404);
      const row = await getCustomRecord(db, customTable, orgId, id as number);
      if (!row) return c.json({ error: "Not found" }, 404);
      return c.json(row);
    }

    if (resource !== "configuration" && isNaN(id as number)) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const row = await getOneRecord(db, { resource, id: id as number, orgId });
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(row);
  };
}
