import type { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import { sortPostSchema } from "@/schemas/views.js";
import * as schema from "@/db/schema/index.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { sortRowToNocoRaw } from "@/routes/views/mappers.js";
import {
  getCrmUserId,
  getViewAndCheckOwnership,
} from "@/routes/views/shared.js";

export function registerSortRoutes(app: Hono, db: Db): void {
  app.get("/view/:viewId/sorts", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const viewId = c.req.param("viewId");
    const session = c.get("session") as { user?: { id: string } };
    const crmUser = await getCrmUserId(db, session);
    if (crmUser == null) return c.json({ error: "User not found in CRM" }, 404);
    const { crmUserId, organizationId } = crmUser;

    const view = await getViewAndCheckOwnership(
      db,
      viewId,
      crmUserId,
      organizationId,
    );
    if (!view) return c.json({ error: "View not found" }, 404);

    const list = await db
      .select()
      .from(schema.viewSorts)
      .where(eq(schema.viewSorts.viewId, viewId))
      .orderBy(asc(schema.viewSorts.displayOrder), asc(schema.viewSorts.id));

    return c.json({ list: list.map(sortRowToNocoRaw) });
  });

  app.post("/view/:viewId/sorts", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const viewId = c.req.param("viewId");
    const session = c.get("session") as { user?: { id: string } };
    const crmUser = await getCrmUserId(db, session);
    if (crmUser == null) return c.json({ error: "User not found in CRM" }, 404);
    const { crmUserId, organizationId } = crmUser;

    const view = await getViewAndCheckOwnership(
      db,
      viewId,
      crmUserId,
      organizationId,
    );
    if (!view) return c.json({ error: "View not found" }, 404);

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = sortPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const body = parsed.data;
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
        direction: body.direction,
        displayOrder,
      })
      .returning();

    if (!inserted) return c.json({ error: "Insert failed" }, 500);
    return c.json(sortRowToNocoRaw(inserted));
  });

  app.delete("/view/:viewId/sorts/:sortId", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const viewId = c.req.param("viewId");
    const sortId = c.req.param("sortId");
    const session = c.get("session") as { user?: { id: string } };
    const crmUser = await getCrmUserId(db, session);
    if (crmUser == null) return c.json({ error: "User not found in CRM" }, 404);
    const { crmUserId, organizationId } = crmUser;

    const view = await getViewAndCheckOwnership(
      db,
      viewId,
      crmUserId,
      organizationId,
    );
    if (!view) return c.json({ error: "View not found" }, 404);

    await db
      .delete(schema.viewSorts)
      .where(
        and(
          eq(schema.viewSorts.viewId, viewId),
          eq(schema.viewSorts.id, sortId),
        ),
      );
    return c.json({});
  });
}
