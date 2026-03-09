import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import {
  customFieldCreateSchema,
  customFieldUpdateSchema,
} from "@/schemas/custom-fields.js";
import { eq, asc, and, or, isNull, sql } from "drizzle-orm";
import * as schema from "@/db/schema/index.js";
import type { Db } from "@/db/client.js";
import type { createAuth } from "@/auth.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";

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
      isNull(schema.customFieldDefs.organizationId),
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

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = customFieldCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const body = parsed.data;
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

  app.patch("/:id", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;

    const id = Number(c.req.param("id"));
    if (!authz.crmUser.organizationId) {
      return c.json({ error: "Organization not found" }, 404);
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = customFieldUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }

    const [existing] = await db
      .select()
      .from(schema.customFieldDefs)
      .where(
        and(
          eq(schema.customFieldDefs.id, id),
          eq(
            schema.customFieldDefs.organizationId,
            authz.crmUser.organizationId,
          ),
        ),
      )
      .limit(1);
    if (!existing) return c.json({ error: "Not found" }, 404);

    const updates: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) updates.label = parsed.data.label;
    if (parsed.data.options !== undefined)
      updates.options = parsed.data.options;

    const newName = parsed.data.name
      ? parsed.data.name.toLowerCase().replace(/[^a-z0-9_]/g, "_")
      : undefined;
    const oldName = existing.name;
    const nameChanged = newName != null && newName !== oldName;
    if (nameChanged) updates.name = newName;

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    const [updated] = await db
      .update(schema.customFieldDefs)
      .set(updates)
      .where(
        and(
          eq(schema.customFieldDefs.id, id),
          eq(
            schema.customFieldDefs.organizationId,
            authz.crmUser.organizationId,
          ),
        ),
      )
      .returning();

    if (!updated) return c.json({ error: "Not found" }, 404);

    if (nameChanged && newName) {
      const resourceToTable: Record<string, string> = {
        contacts: "contacts",
        companies: "companies",
        deals: "deals",
      };
      const tableName = resourceToTable[existing.resource];
      if (tableName) {
        await db.execute(
          sql`UPDATE ${sql.identifier(tableName)}
              SET custom_fields = (custom_fields - ${oldName}) || jsonb_build_object(${newName}, custom_fields -> ${oldName})
              WHERE custom_fields ? ${oldName}
                AND organization_id = ${authz.crmUser.organizationId}`,
        );
      } else {
        const [obj] = await db
          .select({ tableName: schema.objectConfig.tableName })
          .from(schema.objectConfig)
          .where(eq(schema.objectConfig.slug, existing.resource))
          .limit(1);
        if (obj?.tableName) {
          await db.execute(
            sql`UPDATE ${sql.identifier(obj.tableName)}
                SET custom_fields = (custom_fields - ${oldName}) || jsonb_build_object(${newName}, custom_fields -> ${oldName})
                WHERE custom_fields ? ${oldName}
                  AND organization_id = ${authz.crmUser.organizationId}`,
          );
        }
      }
    }

    return c.json(updated);
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
          eq(
            schema.customFieldDefs.organizationId,
            authz.crmUser.organizationId,
          ),
        ),
      )
      .returning();
    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });

  return app;
}
