import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { sql, eq, and, asc } from "drizzle-orm";
import * as schema from "../db/schema/index.js";
import { PERMISSIONS, requirePermission } from "../lib/rbac.js";
const VIEW_TYPE_TO_NUMBER = {
    grid: 3,
    kanban: 2,
    gallery: 4,
    form: 5,
};
const NUMBER_TO_VIEW_TYPE = {
    3: "grid",
    2: "kanban",
    4: "gallery",
    5: "form",
};
async function getCrmUserId(db, session) {
    if (!session?.user?.id)
        return null;
    const [row] = await db
        .select({ id: schema.crmUsers.id })
        .from(schema.crmUsers)
        .where(eq(schema.crmUsers.userId, session.user.id))
        .limit(1);
    return row?.id ?? null;
}
async function getViewAndCheckOwnership(db, viewId, crmUserId) {
    const [row] = await db
        .select()
        .from(schema.views)
        .where(and(eq(schema.views.id, viewId), eq(schema.views.crmUserId, crmUserId)))
        .limit(1);
    return row ?? null;
}
function viewRowToNocoRaw(row) {
    return {
        id: row.id,
        title: row.title,
        type: VIEW_TYPE_TO_NUMBER[row.type] ?? 3,
        order: row.displayOrder,
        is_default: row.isDefault,
        lock_type: row.lockType ?? undefined,
    };
}
function columnRowToNocoRaw(row) {
    return {
        id: row.id,
        fk_column_id: row.fieldId,
        title: row.title,
        show: row.show,
        order: row.displayOrder,
        width: row.width,
    };
}
function sortRowToNocoRaw(row) {
    return {
        id: row.id,
        fk_column_id: row.fieldId,
        direction: row.direction,
        order: row.displayOrder,
    };
}
function filterRowToNocoRaw(row) {
    return {
        id: row.id,
        fk_column_id: row.fieldId,
        comparison_op: row.comparisonOp,
        value: row.value,
        logical_op: row.logicalOp,
    };
}
/** Format column_name for display (e.g. "company_id" → "Company Id"). */
function formatColumnTitle(columnName) {
    if (/[_]/.test(columnName) || /^[A-Z_]+$/.test(columnName)) {
        return columnName
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return columnName;
}
/**
 * Return list of { fieldId, title } for a table (base table name).
 * Matches the schema API: base columns from information_schema + custom fields.
 * Used to seed default view_columns when creating the first view for an object.
 */
async function getColumnListForTable(db, baseTable) {
    const result = await db.execute(sql `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${baseTable}
        ORDER BY ordinal_position`);
    const raw = Array.isArray(result) ? result : result.rows ?? [];
    const rows = raw;
    const out = rows.map((r) => ({
        fieldId: r.column_name,
        title: formatColumnTitle(r.column_name),
    }));
    const customRows = await db
        .select()
        .from(schema.customFieldDefs)
        .where(eq(schema.customFieldDefs.resource, baseTable))
        .orderBy(asc(schema.customFieldDefs.position), asc(schema.customFieldDefs.id));
    for (const def of customRows) {
        out.push({ fieldId: `custom_${def.id}`, title: def.label });
    }
    return out;
}
/** Copy view_columns from sourceViewId to targetViewId. */
async function copyViewColumns(db, sourceViewId, targetViewId) {
    const sourceCols = await db
        .select()
        .from(schema.viewColumns)
        .where(eq(schema.viewColumns.viewId, sourceViewId))
        .orderBy(asc(schema.viewColumns.displayOrder), asc(schema.viewColumns.id));
    if (sourceCols.length === 0)
        return;
    await db.insert(schema.viewColumns).values(sourceCols.map((c) => ({
        viewId: targetViewId,
        fieldId: c.fieldId,
        title: c.title,
        show: c.show,
        displayOrder: c.displayOrder,
    })));
}
/** Seed view_columns for a view from the object's table schema. */
async function seedDefaultViewColumns(db, viewId, objectSlug) {
    const [objConfig] = await db
        .select({ tableName: schema.objectConfig.tableName })
        .from(schema.objectConfig)
        .where(eq(schema.objectConfig.slug, objectSlug))
        .limit(1);
    if (!objConfig)
        return;
    const columns = await getColumnListForTable(db, objConfig.tableName);
    if (columns.length === 0)
        return;
    await db.insert(schema.viewColumns).values(columns.map((col, i) => ({
        viewId,
        fieldId: col.fieldId,
        title: col.title,
        show: col.fieldId !== "id",
        displayOrder: i,
    })));
}
export function createViewRoutes(db, auth) {
    const app = new Hono();
    app.use("*", authMiddleware(auth, db));
    app.get("/:objectSlug", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        const objectSlug = c.req.param("objectSlug");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        let list = await db
            .select()
            .from(schema.views)
            .where(and(eq(schema.views.objectSlug, objectSlug), eq(schema.views.crmUserId, crmUserId)))
            .orderBy(asc(schema.views.displayOrder), asc(schema.views.createdAt));
        if (list.length === 0) {
            const [inserted] = await db
                .insert(schema.views)
                .values({
                objectSlug,
                crmUserId,
                title: "Grid View",
                type: "grid",
                displayOrder: 0,
                isDefault: true,
            })
                .returning();
            if (inserted) {
                list = [inserted];
                await seedDefaultViewColumns(db, inserted.id, objectSlug);
            }
        }
        else {
            // Backfill: if default view has no columns, seed them (e.g. after deploy)
            const defaultView = list.find((v) => v.isDefault) ?? list[0];
            const existingCols = await db
                .select()
                .from(schema.viewColumns)
                .where(eq(schema.viewColumns.viewId, defaultView.id))
                .limit(1);
            if (existingCols.length === 0) {
                await seedDefaultViewColumns(db, defaultView.id, objectSlug);
            }
        }
        return c.json({ list: list.map(viewRowToNocoRaw) });
    });
    app.post("/:objectSlug", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const objectSlug = c.req.param("objectSlug");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const body = await c.req.json();
        const typeNum = body.type ?? 3;
        const typeStr = NUMBER_TO_VIEW_TYPE[typeNum] ?? "grid";
        const [inserted] = await db
            .insert(schema.views)
            .values({
            objectSlug,
            crmUserId,
            title: body.title ?? "Untitled",
            type: typeStr,
            displayOrder: 0,
            isDefault: false,
        })
            .returning();
        if (!inserted)
            return c.json({ error: "Insert failed" }, 500);
        // Seed columns by copying from default view
        const existingViews = await db
            .select()
            .from(schema.views)
            .where(and(eq(schema.views.objectSlug, objectSlug), eq(schema.views.crmUserId, crmUserId)));
        const defaultView = existingViews.find((v) => v.isDefault) ?? existingViews[0];
        if (defaultView && defaultView.id !== inserted.id) {
            await copyViewColumns(db, defaultView.id, inserted.id);
        }
        else {
            await seedDefaultViewColumns(db, inserted.id, objectSlug);
        }
        return c.json(viewRowToNocoRaw(inserted));
    });
    app.post("/view/:viewId/columns", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        const body = await c.req.json();
        const fieldId = body.fk_column_id;
        if (!fieldId || typeof fieldId !== "string") {
            return c.json({ error: "fk_column_id is required" }, 400);
        }
        // Check for duplicate
        const existing = await db
            .select()
            .from(schema.viewColumns)
            .where(and(eq(schema.viewColumns.viewId, viewId), eq(schema.viewColumns.fieldId, fieldId)))
            .limit(1);
        if (existing.length > 0) {
            return c.json({ error: "Column already exists for this view" }, 409);
        }
        let displayOrder;
        if (typeof body.order === "number") {
            displayOrder = body.order;
        }
        else {
            const existingCols = await db
                .select({ displayOrder: schema.viewColumns.displayOrder })
                .from(schema.viewColumns)
                .where(eq(schema.viewColumns.viewId, viewId));
            const maxOrder = existingCols.reduce((m, r) => Math.max(m, r.displayOrder), -1);
            displayOrder = maxOrder + 1;
        }
        const [inserted] = await db
            .insert(schema.viewColumns)
            .values({
            viewId,
            fieldId,
            title: body.title ?? formatColumnTitle(fieldId),
            show: body.show ?? true,
            displayOrder,
        })
            .returning();
        if (!inserted)
            return c.json({ error: "Insert failed" }, 500);
        return c.json(columnRowToNocoRaw(inserted));
    });
    app.get("/view/:viewId/columns", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        const list = await db
            .select()
            .from(schema.viewColumns)
            .where(eq(schema.viewColumns.viewId, viewId))
            .orderBy(asc(schema.viewColumns.displayOrder), asc(schema.viewColumns.id));
        return c.json({ list: list.map(columnRowToNocoRaw) });
    });
    app.patch("/view/:viewId/columns/:columnId", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const columnId = c.req.param("columnId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        const body = await c.req.json();
        const updates = {};
        if (typeof body.show === "boolean")
            updates.show = body.show;
        if (typeof body.order === "number")
            updates.displayOrder = body.order;
        if (body.width !== undefined)
            updates.width = body.width;
        const [updated] = await db
            .update(schema.viewColumns)
            .set(updates)
            .where(and(eq(schema.viewColumns.viewId, viewId), eq(schema.viewColumns.id, columnId)))
            .returning();
        if (!updated)
            return c.json({ error: "Column not found" }, 404);
        return c.json(columnRowToNocoRaw(updated));
    });
    app.get("/view/:viewId/sorts", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        const list = await db
            .select()
            .from(schema.viewSorts)
            .where(eq(schema.viewSorts.viewId, viewId))
            .orderBy(asc(schema.viewSorts.displayOrder), asc(schema.viewSorts.id));
        return c.json({ list: list.map(sortRowToNocoRaw) });
    });
    app.post("/view/:viewId/sorts", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        const body = await c.req.json();
        const existing = await db
            .select()
            .from(schema.viewSorts)
            .where(eq(schema.viewSorts.viewId, viewId));
        const displayOrder = existing.length;
        const [inserted] = await db
            .insert(schema.viewSorts)
            .values({
            viewId,
            fieldId: body.fk_column_id,
            direction: body.direction ?? "asc",
            displayOrder,
        })
            .returning();
        if (!inserted)
            return c.json({ error: "Insert failed" }, 500);
        return c.json(sortRowToNocoRaw(inserted));
    });
    app.delete("/view/:viewId/sorts/:sortId", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const sortId = c.req.param("sortId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        await db
            .delete(schema.viewSorts)
            .where(and(eq(schema.viewSorts.viewId, viewId), eq(schema.viewSorts.id, sortId)));
        return c.json({});
    });
    app.get("/view/:viewId/filters", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        const list = await db
            .select()
            .from(schema.viewFilters)
            .where(eq(schema.viewFilters.viewId, viewId));
        return c.json({ list: list.map(filterRowToNocoRaw) });
    });
    app.post("/view/:viewId/filters", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        const body = await c.req.json();
        const [inserted] = await db
            .insert(schema.viewFilters)
            .values({
            viewId,
            fieldId: body.fk_column_id,
            comparisonOp: body.comparison_op,
            value: body.value != null ? String(body.value) : null,
            logicalOp: body.logical_op ?? "and",
        })
            .returning();
        if (!inserted)
            return c.json({ error: "Insert failed" }, 500);
        return c.json(filterRowToNocoRaw(inserted));
    });
    app.delete("/view/:viewId/filters/:filterId", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const filterId = c.req.param("filterId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        await db
            .delete(schema.viewFilters)
            .where(and(eq(schema.viewFilters.viewId, viewId), eq(schema.viewFilters.id, filterId)));
        return c.json({});
    });
    // PATCH /view/:viewId — rename view
    app.patch("/view/:viewId", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        const body = await c.req.json();
        if (typeof body.title !== "string" || body.title.trim() === "") {
            return c.json({ error: "title is required" }, 400);
        }
        const [updated] = await db
            .update(schema.views)
            .set({ title: body.title.trim() })
            .where(eq(schema.views.id, viewId))
            .returning();
        if (!updated)
            return c.json({ error: "Update failed" }, 500);
        return c.json(viewRowToNocoRaw(updated));
    });
    // DELETE /view/:viewId — delete view (cascades to view_columns, view_sorts, view_filters)
    app.delete("/view/:viewId", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const viewId = c.req.param("viewId");
        const session = c.get("session");
        const crmUserId = await getCrmUserId(db, session);
        if (crmUserId == null)
            return c.json({ error: "User not found in CRM" }, 404);
        const view = await getViewAndCheckOwnership(db, viewId, crmUserId);
        if (!view)
            return c.json({ error: "View not found" }, 404);
        await db.delete(schema.views).where(eq(schema.views.id, viewId));
        return c.json({});
    });
    return app;
}
