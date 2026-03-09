import type { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import { viewPostSchema } from "@/schemas/views.js";
import * as schema from "@/db/schema/index.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import {
  NUMBER_TO_VIEW_TYPE,
  viewRowToNocoRaw,
} from "@/routes/views/mappers.js";
import {
  copyViewColumns,
  getCrmUserId,
  seedDefaultViewColumns,
} from "@/routes/views/shared.js";

export function registerObjectViewRoutes(app: Hono, db: Db): void {
  app.get("/:objectSlug", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const objectSlug = c.req.param("objectSlug");
    const session = c.get("session") as { user?: { id: string } };
    const crmUser = await getCrmUserId(db, session);
    if (crmUser == null) return c.json({ error: "User not found in CRM" }, 404);
    const { crmUserId, organizationId } = crmUser;

    let list = await db
      .select()
      .from(schema.views)
      .where(
        and(
          eq(schema.views.objectSlug, objectSlug),
          eq(schema.views.crmUserId, crmUserId),
          eq(schema.views.organizationId, organizationId),
        ),
      )
      .orderBy(asc(schema.views.displayOrder), asc(schema.views.createdAt));

    if (list.length === 0) {
      const [inserted] = await db
        .insert(schema.views)
        .values({
          objectSlug,
          crmUserId,
          organizationId,
          title: "Grid View",
          type: "grid",
          displayOrder: 0,
          isDefault: true,
        })
        .returning();
      if (inserted) {
        list = [inserted];
        await seedDefaultViewColumns(
          db,
          inserted.id,
          objectSlug,
          organizationId,
        );
      }
    } else {
      const defaultView = list.find((v) => v.isDefault) ?? list[0];
      const existingCols = await db
        .select()
        .from(schema.viewColumns)
        .where(eq(schema.viewColumns.viewId, defaultView.id))
        .limit(1);
      if (existingCols.length === 0) {
        await seedDefaultViewColumns(
          db,
          defaultView.id,
          objectSlug,
          organizationId,
        );
      }
    }

    return c.json({ list: list.map(viewRowToNocoRaw) });
  });

  app.post("/:objectSlug", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const objectSlug = c.req.param("objectSlug");
    const session = c.get("session") as { user?: { id: string } };
    const crmUser = await getCrmUserId(db, session);
    if (crmUser == null) return c.json({ error: "User not found in CRM" }, 404);
    const { crmUserId, organizationId } = crmUser;

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = viewPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const body = parsed.data;
    const typeNum = body.type ?? 3;
    const typeStr = NUMBER_TO_VIEW_TYPE[typeNum] ?? "grid";

    const [inserted] = await db
      .insert(schema.views)
      .values({
        objectSlug,
        crmUserId,
        organizationId,
        title: body.title,
        type: typeStr,
        displayOrder: 0,
        isDefault: false,
      })
      .returning();

    if (!inserted) return c.json({ error: "Insert failed" }, 500);

    const existingViews = await db
      .select()
      .from(schema.views)
      .where(
        and(
          eq(schema.views.objectSlug, objectSlug),
          eq(schema.views.crmUserId, crmUserId),
          eq(schema.views.organizationId, organizationId),
        ),
      );
    const defaultView =
      existingViews.find((v) => v.isDefault) ?? existingViews[0];
    if (defaultView && defaultView.id !== inserted.id) {
      await copyViewColumns(db, defaultView.id, inserted.id);
    } else {
      await seedDefaultViewColumns(db, inserted.id, objectSlug, organizationId);
    }

    return c.json(viewRowToNocoRaw(inserted));
  });
}
