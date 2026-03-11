import { PERMISSIONS, requirePermission } from "../../../lib/rbac.js";
import { jsonError } from "../../../lib/api-error.js";
import { createRecord } from "../../../services/crm/create-record.js";
import { snakeToCamel } from "../../../routes/crm/utils.js";
import { CRM_RESOURCES, TABLE_MAP, } from "../../../routes/crm/constants.js";
import { resolveCustomTable, insertCustomRecord, } from "../../../data-access/crm/dynamic-table.js";
export function createCreateHandler(db, env) {
    return async (c) => {
        const resource = c.req.param("resource");
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const { crmUser } = authz;
        const crmUserId = crmUser.id;
        const orgId = crmUser.organizationId;
        if (!crmUserId || !orgId) {
            return jsonError(c, "Organization not found", 404, "NOT_FOUND");
        }
        // Handle custom object tables
        if (!CRM_RESOURCES.includes(resource) ||
            (!TABLE_MAP[resource] &&
                !resource.endsWith("_summary"))) {
            const customTable = await resolveCustomTable(db, resource, orgId);
            if (!customTable) {
                return jsonError(c, "Unknown resource", 404, "NOT_FOUND");
            }
            let rawBody;
            try {
                rawBody = (await c.req.json());
            }
            catch {
                return jsonError(c, "Invalid JSON body", 400, "VALIDATION_FAILED");
            }
            const record = await insertCustomRecord(db, customTable, rawBody, crmUserId, orgId);
            if (!record)
                return jsonError(c, "Insert failed", 500, "INSERT_FAILED");
            return c.json(record, 201);
        }
        if (resource.endsWith("_summary")) {
            return jsonError(c, "Cannot create on this resource", 400, "INVALID_RESOURCE");
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
        const body = snakeToCamel(rawBody);
        const result = await createRecord(db, env, {
            resource,
            body,
            crmUserId,
            orgId,
            crmUserRow: crmUser,
        });
        if (!result.success) {
            const status = result.error === "Insert failed"
                ? 500
                : result.error === "Not found"
                    ? 404
                    : 400;
            const code = result.error === "Insert failed"
                ? "INSERT_FAILED"
                : result.error === "Not found"
                    ? "NOT_FOUND"
                    : "VALIDATION_FAILED";
            return jsonError(c, result.error, status, code);
        }
        return c.json(result.record, 201);
    };
}
