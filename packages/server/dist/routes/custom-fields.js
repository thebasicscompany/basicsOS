import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { eq, asc } from "drizzle-orm";
import * as schema from "../db/schema/index.js";
import { PERMISSIONS, requirePermission } from "../lib/rbac.js";
export function createCustomFieldRoutes(db, auth) {
    const app = new Hono();
    app.use("*", authMiddleware(auth, db));
    app.get("/", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        const resource = c.req.query("resource");
        const order = [
            asc(schema.customFieldDefs.position),
            asc(schema.customFieldDefs.id),
        ];
        const rows = resource
            ? await db
                .select()
                .from(schema.customFieldDefs)
                .where(eq(schema.customFieldDefs.resource, resource))
                .orderBy(...order)
            : await db
                .select()
                .from(schema.customFieldDefs)
                .orderBy(...order);
        return c.json(rows);
    });
    app.post("/", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
        if (!authz.ok)
            return authz.response;
        const body = await c.req.json();
        if (!body.resource || !body.name || !body.label || !body.fieldType) {
            return c.json({ error: "resource, name, label, fieldType are required" }, 400);
        }
        const safeName = body.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
        const [row] = await db
            .insert(schema.customFieldDefs)
            .values({
            resource: body.resource,
            name: safeName,
            label: body.label,
            fieldType: body.fieldType,
            options: body.options ?? null,
        })
            .returning();
        return c.json(row, 201);
    });
    app.delete("/:id", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
        if (!authz.ok)
            return authz.response;
        const id = Number(c.req.param("id"));
        await db
            .delete(schema.customFieldDefs)
            .where(eq(schema.customFieldDefs.id, id));
        return c.json({ ok: true });
    });
    return app;
}
