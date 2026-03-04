import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { eq, asc, and, or, isNull } from "drizzle-orm";
import * as schema from "../db/schema/index.js";
import type { Db } from "../db/client.js";
import type { createAuth } from "../auth.js";
import { PERMISSIONS, requirePermission } from "../lib/rbac.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

export function createCustomFieldRoutes(db: Db, auth: BetterAuthInstance) {
  const app = new Hono();
  app.use("*", authMiddleware(auth, db));

  app.get("/", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const orgId = authz.crmUser.organizationId;
    if (!orgId) return c.json({ error: "Organization not found" }, 404);

    const resource = c.req.query("resource");
    const order = [
      asc(schema.customFieldDefs.position),
      asc(schema.customFieldDefs.id),
    ] as const;
    const baseFilter = or(
      eq(schema.customFieldDefs.organizationId, orgId),
      isNull(schema.customFieldDefs.organizationId)
    );
    const rows = resource
      ? await db
          .select()
          .from(schema.customFieldDefs)
          .where(and(eq(schema.customFieldDefs.resource, resource), baseFilter))
          .orderBy(...order)
      : await db
          .select()
          .from(schema.customFieldDefs)
          .where(baseFilter)
          .orderBy(...order);
    return c.json(rows);
  });

  app.post("/", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;

    const body = await c.req.json<{
      resource: string;
      name: string;
      label: string;
      fieldType: string;
      options?: string[];
    }>();
    if (!body.resource || !body.name || !body.label || !body.fieldType) {
      return c.json(
        { error: "resource, name, label, fieldType are required" },
        400
      );
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
        organizationId: authz.crmUser.organizationId,
      })
      .returning();
    return c.json(row, 201);
  });

  app.delete("/:id", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;

    const id = Number(c.req.param("id"));
    if (!authz.crmUser.organizationId) {
      return c.json({ error: "Organization not found" }, 404);
    }
    const deleted = await db
      .delete(schema.customFieldDefs)
      .where(
        and(
          eq(schema.customFieldDefs.id, id),
          eq(schema.customFieldDefs.organizationId, authz.crmUser.organizationId)
        )
      )
      .returning();
    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });

  return app;
}
