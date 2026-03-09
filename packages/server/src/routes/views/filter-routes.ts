import type { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import { filterPostSchema } from "@/schemas/views.js";
import * as schema from "@/db/schema/index.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { filterRowToNocoRaw } from "@/routes/views/mappers.js";
import {
  getCrmUserId,
  getViewAndCheckOwnership,
} from "@/routes/views/shared.js";

export function registerFilterRoutes(app: Hono, db: Db): void {
  app.get("/view/:viewId/filters", async (c) => {
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
      .from(schema.viewFilters)
      .where(eq(schema.viewFilters.viewId, viewId));

    return c.json({ list: list.map(filterRowToNocoRaw) });
  });

  app.post("/view/:viewId/filters", async (c) => {
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
    const parsed = filterPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const body = parsed.data;

    const [inserted] = await db
      .insert(schema.viewFilters)
      .values({
        viewId,
        fieldId: body.fk_column_id,
        comparisonOp: body.comparison_op,
        value: body.value != null ? String(body.value) : null,
        logicalOp: body.logical_op,
      })
      .returning();

    if (!inserted) return c.json({ error: "Insert failed" }, 500);
    return c.json(filterRowToNocoRaw(inserted));
  });

  app.delete("/view/:viewId/filters/:filterId", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const viewId = c.req.param("viewId");
    const filterId = c.req.param("filterId");
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
      .delete(schema.viewFilters)
      .where(
        and(
          eq(schema.viewFilters.viewId, viewId),
          eq(schema.viewFilters.id, filterId),
        ),
      );
    return c.json({});
  });
}
