import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import { viewPatchSchema } from "@/schemas/views.js";
import * as schema from "@/db/schema/index.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { viewRowToNocoRaw } from "@/routes/views/mappers.js";
import {
  getCrmUserId,
  getViewAndCheckOwnership,
} from "@/routes/views/shared.js";

export function registerViewItemRoutes(app: Hono, db: Db): void {
  app.patch("/view/:viewId", async (c) => {
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
    const parsed = viewPatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }

    const [updated] = await db
      .update(schema.views)
      .set({ title: parsed.data.title })
      .where(eq(schema.views.id, viewId))
      .returning();

    if (!updated) return c.json({ error: "Update failed" }, 500);
    return c.json(viewRowToNocoRaw(updated));
  });

  app.delete("/view/:viewId", async (c) => {
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

    await db.delete(schema.views).where(eq(schema.views.id, viewId));
    return c.json({});
  });
}
