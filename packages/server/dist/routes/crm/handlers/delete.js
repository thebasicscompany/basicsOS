import { jsonError } from "@/lib/api-error.js";
import { PERMISSIONS, getCrmUserFromSession, getPermissionSetForUser, hasPermission, } from "@/lib/rbac.js";
import { deleteRecord } from "@/services/crm/delete-record.js";
import { CRM_RESOURCES, TABLE_MAP, } from "@/routes/crm/constants.js";
import { resolveCustomTable, deleteCustomRecord, getCustomRecord, } from "@/data-access/crm/dynamic-table.js";
export function createDeleteHandler(db) {
    return async (c) => {
        const resource = c.req.param("resource");
        const id = parseInt(c.req.param("id"), 10);
        if (isNaN(id)) {
            return jsonError(c, "Invalid request", 400, "INVALID_REQUEST");
        }
        const crmUser = await getCrmUserFromSession(c, db);
        if (!crmUser)
            return jsonError(c, "User not found in CRM", 404, "NOT_FOUND");
        const orgId = crmUser.organizationId;
        if (!orgId)
            return jsonError(c, "Organization not found", 404, "NOT_FOUND");
        // Handle custom object tables
        if (!CRM_RESOURCES.includes(resource) ||
            (!TABLE_MAP[resource] &&
                !resource.endsWith("_summary"))) {
            const customTable = await resolveCustomTable(db, resource, orgId);
            if (!customTable)
                return c.json({ error: "Unknown resource" }, 404);
            const existing = await getCustomRecord(db, customTable, orgId, id);
            if (!existing)
                return jsonError(c, "Not found", 404, "NOT_FOUND");
            await deleteCustomRecord(db, customTable, id, orgId);
            return c.json(existing);
        }
        if (resource.endsWith("_summary")) {
            return jsonError(c, "Invalid request", 400, "INVALID_REQUEST");
        }
        const permissions = await getPermissionSetForUser(db, crmUser);
        const canHardDelete = hasPermission(permissions, "*") ||
            hasPermission(permissions, PERMISSIONS.recordsDeleteHard);
        const canArchive = hasPermission(permissions, "*") ||
            hasPermission(permissions, PERMISSIONS.recordsArchive);
        if (!TABLE_MAP[resource]) {
            return c.json({ error: "Unknown resource" }, 404);
        }
        const result = await deleteRecord(db, {
            resource,
            id,
            orgId,
            crmUserId: crmUser.id,
            canHardDelete,
            canArchive,
        });
        if (!result.success) {
            const status = result.error === "Not found" ? 404 : 403;
            const code = result.error === "Not found" ? "NOT_FOUND" : "FORBIDDEN";
            return jsonError(c, result.error, status, code);
        }
        if (result.archived) {
            return c.json({ archived: true, record: result.record });
        }
        return c.json(result.record);
    };
}
