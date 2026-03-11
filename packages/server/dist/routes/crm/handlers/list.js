import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { listRecords, isListableResource } from "@/data-access/crm/list.js";
import { parseRange, parseFilter, parseGenericFilters, parseSorts, } from "@/schemas/crm/list-params.js";
import { resolveCustomTable, listCustomRecords, } from "@/data-access/crm/dynamic-table.js";
export function createListHandler(db) {
    return async (c) => {
        const resource = c.req.param("resource");
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        const { crmUser } = authz;
        const orgId = crmUser.organizationId;
        if (!orgId)
            return c.json({ error: "Organization not found" }, 404);
        // Try custom table if not a built-in resource
        if (!isListableResource(resource)) {
            const customTable = await resolveCustomTable(db, resource, orgId);
            if (!customTable)
                return c.json({ error: "Unknown resource" }, 404);
            const [start, end] = parseRange(c.req.query("range"));
            const sortParam = c.req.query("sort");
            const orderParam = c.req.query("order");
            const parsedSorts = parseSorts(c.req.query("sorts"));
            const limit = Math.max(0, end - start + 1);
            const { rows, total } = await listCustomRecords(db, customTable, orgId, {
                limit,
                offset: start,
                sort: parsedSorts[0]?.field ?? sortParam,
                order: parsedSorts[0]?.order ?? orderParam,
            });
            c.header("Content-Range", `${resource} ${start}-${Math.min(start + rows.length, total)}/${total}`);
            return c.json(rows);
        }
        const [start, end] = parseRange(c.req.query("range"));
        const filter = parseFilter(c.req.query("filter"));
        const genericFilters = parseGenericFilters(c.req.query("filters"));
        const sortParam = c.req.query("sort");
        const orderParam = c.req.query("order");
        const parsedSorts = parseSorts(c.req.query("sorts"));
        const sorts = parsedSorts.length > 0
            ? parsedSorts
            : sortParam
                ? [
                    {
                        field: sortParam,
                        order: orderParam === "DESC" ? "DESC" : "ASC",
                    },
                ]
                : [];
        const { rows, total } = await listRecords(db, {
            resource,
            orgId,
            start,
            end,
            sorts,
            filter,
            genericFilters,
        });
        c.header("Content-Range", `${resource} ${start}-${Math.min(start + rows.length, total)}/${total}`);
        return c.json(rows);
    };
}
