import type { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import { columnPostSchema, columnPatchSchema } from "@/schemas/views.js";
import * as schema from "@/db/schema/index.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { columnRowToNocoRaw } from "@/routes/views/mappers.js";
import {
  formatColumnTitle,
  getCrmUserId,
  getViewAndCheckOwnership,
} from "@/routes/views/shared.js";

export function registerColumnRoutes(app: Hono, db: Db): void {
  app.post("/view/:viewId/columns", async (c) => {
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
    const parsed = columnPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const body = parsed.data;
    const fieldId = body.fk_column_id;

    const existing = await db
      .select()
      .from(schema.viewColumns)
      .where(
        and(
          eq(schema.viewColumns.viewId, viewId),
          eq(schema.viewColumns.fieldId, fieldId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return c.json({ error: "Column already exists for this view" }, 409);
    }

    let displayOrder: number;
    if (typeof body.order === "number") {
      displayOrder = body.order;
    } else {
      const existingCols = await db
        .select({ displayOrder: schema.viewColumns.displayOrder })
        .from(schema.viewColumns)
        .where(eq(schema.viewColumns.viewId, viewId));
      const maxOrder = existingCols.reduce(
        (m, r) => Math.max(m, r.displayOrder),
        -1,
      );
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

    if (!inserted) return c.json({ error: "Insert failed" }, 500);
    return c.json(columnRowToNocoRaw(inserted));
  });

  app.get("/view/:viewId/columns", async (c) => {
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
      .from(schema.viewColumns)
      .where(eq(schema.viewColumns.viewId, viewId))
      .orderBy(
        asc(schema.viewColumns.displayOrder),
        asc(schema.viewColumns.id),
      );

    return c.json({ list: list.map(columnRowToNocoRaw) });
  });

  app.patch("/view/:viewId/columns/:columnId", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const viewId = c.req.param("viewId");
    const columnId = c.req.param("columnId");
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
    const parsed = columnPatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const body = parsed.data;
    const updates: Partial<typeof schema.viewColumns.$inferInsert> = {};
    if (typeof body.show === "boolean") updates.show = body.show;
    if (typeof body.order === "number") updates.displayOrder = body.order;
    if (body.width !== undefined) updates.width = body.width;
    if (body.title !== undefined) updates.title = body.title;

    const [updated] = await db
      .update(schema.viewColumns)
      .set(updates)
      .where(
        and(
          eq(schema.viewColumns.viewId, viewId),
          eq(schema.viewColumns.id, columnId),
        ),
      )
      .returning();

    if (!updated) return c.json({ error: "Column not found" }, 404);
    return c.json(columnRowToNocoRaw(updated));
  });
}
