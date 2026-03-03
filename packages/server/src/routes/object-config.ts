import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import type { createAuth } from "../auth.js";
import * as schema from "../db/schema/index.js";
import { eq, and, asc } from "drizzle-orm";

type BetterAuthInstance = ReturnType<typeof createAuth>;

export function createObjectConfigRoutes(
  db: Db,
  auth: BetterAuthInstance,
  _env: Env,
) {
  const app = new Hono();

  app.use("*", authMiddleware(auth));

  // GET / — List all objects with their attribute overrides
  app.get("/", async (c) => {
    try {
      const objects = await db
        .select()
        .from(schema.objectConfig)
        .orderBy(
          asc(schema.objectConfig.position),
          asc(schema.objectConfig.id),
        );

      const overrides = await db
        .select()
        .from(schema.objectAttributeOverrides)
        .orderBy(asc(schema.objectAttributeOverrides.id));

      // Group overrides by objectConfigId
      const overridesByConfigId = new Map<
        number,
        (typeof overrides)[number][]
      >();
      for (const override of overrides) {
        const list = overridesByConfigId.get(override.objectConfigId) ?? [];
        list.push(override);
        overridesByConfigId.set(override.objectConfigId, list);
      }

      const result = objects.map((obj) => ({
        ...obj,
        attributes: overridesByConfigId.get(obj.id) ?? [],
      }));

      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // --- Favorites (static paths registered BEFORE dynamic :slug params) ---

  // POST /favorites — Toggle favorite (insert or delete)
  app.post("/favorites", async (c) => {
    try {
      const session = c.get("session") as { user?: { id: string } };
      const userId = session?.user?.id;
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      const body = await c.req.json<{
        objectSlug: string;
        recordId: number;
      }>();

      if (!body.objectSlug || body.recordId == null) {
        return c.json({ error: "objectSlug and recordId are required" }, 400);
      }

      // Look up the sales row for this user
      const [salesRow] = await db
        .select()
        .from(schema.sales)
        .where(eq(schema.sales.userId, userId))
        .limit(1);

      if (!salesRow) {
        return c.json({ error: "User not found in CRM" }, 404);
      }

      // Check if favorite already exists
      const [existing] = await db
        .select()
        .from(schema.recordFavorites)
        .where(
          and(
            eq(schema.recordFavorites.salesId, salesRow.id),
            eq(schema.recordFavorites.objectSlug, body.objectSlug),
            eq(schema.recordFavorites.recordId, body.recordId),
          ),
        )
        .limit(1);

      if (existing) {
        // Remove favorite
        await db
          .delete(schema.recordFavorites)
          .where(eq(schema.recordFavorites.id, existing.id));

        return c.json({ favorited: false });
      } else {
        // Add favorite
        await db.insert(schema.recordFavorites).values({
          salesId: salesRow.id,
          objectSlug: body.objectSlug,
          recordId: body.recordId,
        });

        return c.json({ favorited: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /favorites — List user's favorites
  app.get("/favorites", async (c) => {
    try {
      const session = c.get("session") as { user?: { id: string } };
      const userId = session?.user?.id;
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      // Look up the sales row for this user
      const [salesRow] = await db
        .select()
        .from(schema.sales)
        .where(eq(schema.sales.userId, userId))
        .limit(1);

      if (!salesRow) {
        return c.json({ error: "User not found in CRM" }, 404);
      }

      const objectSlug = c.req.query("objectSlug");

      const conditions = [eq(schema.recordFavorites.salesId, salesRow.id)];
      if (objectSlug) {
        conditions.push(eq(schema.recordFavorites.objectSlug, objectSlug));
      }

      const favorites = await db
        .select()
        .from(schema.recordFavorites)
        .where(and(...conditions))
        .orderBy(asc(schema.recordFavorites.createdAt));

      return c.json(favorites);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // --- Dynamic :slug routes ---

  // PUT /:slug — Update object config (partial)
  app.put("/:slug", async (c) => {
    const slug = c.req.param("slug");

    try {
      const body = await c.req.json<{
        singularName?: string;
        pluralName?: string;
        icon?: string;
        iconColor?: string;
        tableName?: string;
        type?: string;
        isActive?: boolean;
        position?: number;
        settings?: Record<string, unknown>;
      }>();

      const [existing] = await db
        .select()
        .from(schema.objectConfig)
        .where(eq(schema.objectConfig.slug, slug))
        .limit(1);

      if (!existing) {
        return c.json({ error: "Object config not found" }, 404);
      }

      // Build update object with only provided fields
      const updates: Record<string, unknown> = {};
      if (body.singularName !== undefined)
        updates.singularName = body.singularName;
      if (body.pluralName !== undefined) updates.pluralName = body.pluralName;
      if (body.icon !== undefined) updates.icon = body.icon;
      if (body.iconColor !== undefined) updates.iconColor = body.iconColor;
      if (body.tableName !== undefined)
        updates.tableName = body.tableName;
      if (body.type !== undefined) updates.type = body.type;
      if (body.isActive !== undefined) updates.isActive = body.isActive;
      if (body.position !== undefined) updates.position = body.position;
      if (body.settings !== undefined) updates.settings = body.settings;

      if (Object.keys(updates).length === 0) {
        return c.json(existing);
      }

      const [updated] = await db
        .update(schema.objectConfig)
        .set(updates)
        .where(eq(schema.objectConfig.slug, slug))
        .returning();

      return c.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /:slug/overrides — Create/update attribute override (upsert by column_name)
  app.post("/:slug/overrides", async (c) => {
    const slug = c.req.param("slug");

    try {
      const body = await c.req.json<{
        columnName: string;
        displayName?: string | null;
        uiType?: string | null;
        icon?: string | null;
        isPrimary?: boolean;
        isHiddenByDefault?: boolean;
        config?: Record<string, unknown>;
      }>();

      if (!body.columnName) {
        return c.json({ error: "columnName is required" }, 400);
      }

      // Find the object config by slug
      const [objConfig] = await db
        .select()
        .from(schema.objectConfig)
        .where(eq(schema.objectConfig.slug, slug))
        .limit(1);

      if (!objConfig) {
        return c.json({ error: "Object config not found" }, 404);
      }

      // Check if override already exists
      const [existing] = await db
        .select()
        .from(schema.objectAttributeOverrides)
        .where(
          and(
            eq(schema.objectAttributeOverrides.objectConfigId, objConfig.id),
            eq(schema.objectAttributeOverrides.columnName, body.columnName),
          ),
        )
        .limit(1);

      if (existing) {
        // Update existing override
        const updates: Record<string, unknown> = {};
        if (body.displayName !== undefined)
          updates.displayName = body.displayName;
        if (body.uiType !== undefined) updates.uiType = body.uiType;
        if (body.icon !== undefined) updates.icon = body.icon;
        if (body.isPrimary !== undefined) updates.isPrimary = body.isPrimary;
        if (body.isHiddenByDefault !== undefined)
          updates.isHiddenByDefault = body.isHiddenByDefault;
        if (body.config !== undefined) updates.config = body.config;

        const [updated] = await db
          .update(schema.objectAttributeOverrides)
          .set(updates)
          .where(eq(schema.objectAttributeOverrides.id, existing.id))
          .returning();

        return c.json(updated);
      } else {
        // Insert new override
        const [created] = await db
          .insert(schema.objectAttributeOverrides)
          .values({
            objectConfigId: objConfig.id,
            columnName: body.columnName,
            displayName: body.displayName ?? null,
            uiType: body.uiType ?? null,
            icon: body.icon ?? null,
            isPrimary: body.isPrimary ?? false,
            isHiddenByDefault: body.isHiddenByDefault ?? false,
            config: body.config ?? {},
          })
          .returning();

        return c.json(created, 201);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
