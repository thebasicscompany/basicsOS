import { PERMISSIONS, requirePermission } from "../../../lib/rbac.js";
import { jsonError } from "../../../lib/api-error.js";
import { updateRecordService } from "../../../services/crm/update-record.js";
import { snakeToCamel } from "../../../routes/crm/utils.js";
import { CRM_RESOURCES, TABLE_MAP, } from "../../../routes/crm/constants.js";
import { resolveCustomTable, updateCustomRecord, } from "../../../data-access/crm/dynamic-table.js";
export function createUpdateHandler(db, env) {
    return async (c) => {
        const resource = c.req.param("resource");
        const idRaw = c.req.param("id");
        const id = parseInt(idRaw, 10);
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const { crmUser } = authz;
        const crmUserId = crmUser.id;
        const orgId = crmUser.organizationId;
        if (!crmUserId || !orgId) {
            return c.json({ error: "Organization not found" }, 404);
        }
        // Handle custom object tables
        if (!CRM_RESOURCES.includes(resource) ||
            (!TABLE_MAP[resource] &&
                !resource.endsWith("_summary"))) {
            if (isNaN(id))
                return c.json({ error: "Invalid request" }, 400);
            const customTable = await resolveCustomTable(db, resource, orgId);
            if (!customTable)
                return jsonError(c, "Unknown resource", 404, "NOT_FOUND");
            let rawBody;
            try {
                rawBody = (await c.req.json());
            }
            catch {
                return jsonError(c, "Invalid JSON body", 400, "VALIDATION_FAILED");
            }
            delete rawBody.id;
            const record = await updateCustomRecord(db, customTable, id, orgId, rawBody);
            if (!record)
                return jsonError(c, "Not found", 404, "NOT_FOUND");
            return c.json(record);
        }
        const resolvedId = resource === "configuration" ? 1 : id;
        if (resource !== "configuration" && isNaN(id)) {
            return c.json({ error: "Invalid request" }, 400);
        }
        if (resource.endsWith("_summary")) {
            return c.json({ error: "Invalid request" }, 400);
        }
        if (resource === "crm_users" && !authz.permissions.has("*")) {
            return jsonError(c, "Forbidden", 403, "FORBIDDEN");
        }
        let rawBody;
        try {
            rawBody = (await c.req.json());
        }
        catch {
            return jsonError(c, "Invalid JSON body", 400, "VALIDATION_FAILED");
        }
        delete rawBody.id;
        const body = snakeToCamel(rawBody);
        const result = await updateRecordService(db, env, {
            resource,
            id: resolvedId,
            body,
            orgId,
            crmUserId,
            crmUserRow: crmUser,
        });
        if (!result.success) {
            const status = result.error === "Not found" ? 404 : 400;
            const code = result.error === "Not found" ? "NOT_FOUND" : "VALIDATION_FAILED";
            return jsonError(c, result.error, status, code);
        }
        return c.json(result.record);
    };
}
