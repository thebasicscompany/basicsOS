import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import { favoritesPostSchema, objectConfigPutSchema, objectConfigCreateSchema, attributeOverridePostSchema, } from "@/schemas/object-config.js";
import * as schema from "@/db/schema/index.js";
import { eq, and, asc, or, isNull, inArray, sql } from "drizzle-orm";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { writeAuditLogSafe } from "@/lib/audit-log.js";
export function createObjectConfigRoutes(db, auth, _env) {
    const app = new Hono();
    app.use("*", authMiddleware(auth, db));
    const requireObjectConfigWrite = async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
        if (!authz.ok)
            return authz.response;
        return null;
    };
    // GET / — List all objects with their attribute overrides
    app.get("/", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        const orgId = authz.crmUser.organizationId;
        if (!orgId)
            return c.json({ error: "Organization not found" }, 404);
        try {
            const objects = await db
                .select()
                .from(schema.objectConfig)
                .where(or(eq(schema.objectConfig.organizationId, orgId), isNull(schema.objectConfig.organizationId)))
                .orderBy(asc(schema.objectConfig.position), asc(schema.objectConfig.id));
            const objectIds = objects.map((obj) => obj.id);
            const overrides = await db
                .select()
                .from(schema.objectAttributeOverrides)
                .where(and(objectIds.length > 0
                ? inArray(schema.objectAttributeOverrides.objectConfigId, objectIds)
                : eq(schema.objectAttributeOverrides.objectConfigId, -1), or(eq(schema.objectAttributeOverrides.organizationId, orgId), isNull(schema.objectAttributeOverrides.organizationId))))
                .orderBy(asc(schema.objectAttributeOverrides.id));
            // Group overrides by objectConfigId
            const overridesByConfigId = new Map();
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
        }
        catch (err) {
            console.error("[object-config] list failed:", err);
            return c.json({ error: "Failed to load object config" }, 500);
        }
    });
    // POST / — Create a new custom object (table + config + optional fields)
    app.post("/", async (c) => {
        const adminError = await requireObjectConfigWrite(c);
        if (adminError)
            return adminError;
        const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
        if (!authz.ok)
            return authz.response;
        const orgId = authz.crmUser.organizationId;
        if (!orgId)
            return c.json({ error: "Organization not found" }, 404);
        let rawBody;
        try {
            rawBody = await c.req.json();
        }
        catch {
            return c.json({ error: "Invalid JSON body" }, 400);
        }
        const parsed = objectConfigCreateSchema.safeParse(rawBody);
        if (!parsed.success) {
            const msg = parsed.error.issues[0]?.message ?? "Validation failed";
            return c.json({ error: msg }, 400);
        }
        const body = parsed.data;
        // Derive slug and table name from plural name
        const slug = body.pluralName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "");
        const tableName = `custom_${slug}`;
        // Check for duplicate slug
        const [existing] = await db
            .select()
            .from(schema.objectConfig)
            .where(eq(schema.objectConfig.slug, slug))
            .limit(1);
        if (existing) {
            return c.json({ error: "An object with this name already exists" }, 409);
        }
        try {
            // 1. Create the backing table with standard columns + name
            await db.execute(sql `CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
          id BIGSERIAL PRIMARY KEY,
          name VARCHAR(255),
          crm_user_id BIGINT,
          organization_id UUID,
          custom_fields JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
            // 2. Create index on organization_id
            await db.execute(sql `CREATE INDEX IF NOT EXISTS ${sql.identifier(`idx_${tableName}_org`)} ON ${sql.identifier(tableName)} (organization_id)`);
            // 3. Get max position
            const [maxPos] = await db
                .select({ maxPos: sql `COALESCE(MAX(position), 0)` })
                .from(schema.objectConfig);
            const nextPosition = (maxPos?.maxPos ?? 0) + 1;
            // 4. Insert object_config row
            const [created] = await db
                .insert(schema.objectConfig)
                .values({
                slug,
                singularName: body.singularName,
                pluralName: body.pluralName,
                icon: body.icon,
                iconColor: body.iconColor,
                tableName,
                type: "standard",
                isActive: true,
                position: nextPosition,
                settings: {},
                organizationId: orgId,
            })
                .returning();
            // 5. Create a "name" attribute override marked as primary
            if (created) {
                await db.insert(schema.objectAttributeOverrides).values({
                    objectConfigId: created.id,
                    columnName: "name",
                    displayName: "Name",
                    uiType: "text",
                    isPrimary: true,
                    isHiddenByDefault: false,
                    config: {},
                    organizationId: orgId,
                });
            }
            // 6. Insert any initial custom field defs
            if (body.fields.length > 0 && created) {
                await db.insert(schema.customFieldDefs).values(body.fields.map((f, i) => ({
                    resource: tableName,
                    name: f.name,
                    label: f.label,
                    fieldType: f.fieldType,
                    options: f.options ?? null,
                    position: i + 1,
                    organizationId: orgId,
                })));
            }
            await writeAuditLogSafe(db, {
                crmUserId: authz.crmUser.id,
                organizationId: orgId,
                action: "object_config.created",
                entityType: "object_config",
                entityId: created?.id ?? 0,
                metadata: { slug, tableName },
            });
            return c.json(created, 201);
        }
        catch (err) {
            console.error("[object-config] create failed:", err);
            return c.json({ error: "Failed to create object" }, 500);
        }
    });
    // --- Favorites (static paths registered BEFORE dynamic :slug params) ---
    // POST /favorites — Toggle favorite (insert or delete)
    app.post("/favorites", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        try {
            const session = c.get("session");
            const userId = session?.user?.id;
            if (!userId)
                return c.json({ error: "Unauthorized" }, 401);
            let rawBody;
            try {
                rawBody = await c.req.json();
            }
            catch {
                return c.json({ error: "Invalid JSON body" }, 400);
            }
            const parsed = favoritesPostSchema.safeParse(rawBody);
            if (!parsed.success) {
                const msg = parsed.error.issues[0]?.message ?? "Validation failed";
                return c.json({ error: msg }, 400);
            }
            const body = parsed.data;
            // Look up the CRM user for this user
            const [crmUserRow] = await db
                .select()
                .from(schema.crmUsers)
                .where(eq(schema.crmUsers.userId, userId))
                .limit(1);
            if (!crmUserRow) {
                return c.json({ error: "User not found in CRM" }, 404);
            }
            if (!crmUserRow.organizationId) {
                return c.json({ error: "Organization not found" }, 404);
            }
            // Check if favorite already exists
            const [existing] = await db
                .select()
                .from(schema.recordFavorites)
                .where(and(eq(schema.recordFavorites.crmUserId, crmUserRow.id), eq(schema.recordFavorites.organizationId, crmUserRow.organizationId), eq(schema.recordFavorites.objectSlug, body.objectSlug), eq(schema.recordFavorites.recordId, body.recordId)))
                .limit(1);
            if (existing) {
                // Remove favorite
                await db
                    .delete(schema.recordFavorites)
                    .where(eq(schema.recordFavorites.id, existing.id));
                return c.json({ favorited: false });
            }
            else {
                // Add favorite
                await db.insert(schema.recordFavorites).values({
                    crmUserId: crmUserRow.id,
                    organizationId: crmUserRow.organizationId,
                    objectSlug: body.objectSlug,
                    recordId: body.recordId,
                });
                return c.json({ favorited: true });
            }
        }
        catch (err) {
            console.error("[object-config] toggle favorite failed:", err);
            return c.json({ error: "Failed to update favorite" }, 500);
        }
    });
    // GET /favorites — List user's favorites
    app.get("/favorites", async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
        if (!authz.ok)
            return authz.response;
        try {
            const session = c.get("session");
            const userId = session?.user?.id;
            if (!userId)
                return c.json({ error: "Unauthorized" }, 401);
            // Look up the CRM user for this user
            const [crmUserRow] = await db
                .select()
                .from(schema.crmUsers)
                .where(eq(schema.crmUsers.userId, userId))
                .limit(1);
            if (!crmUserRow) {
                return c.json({ error: "User not found in CRM" }, 404);
            }
            if (!crmUserRow.organizationId) {
                return c.json({ error: "Organization not found" }, 404);
            }
            const objectSlug = c.req.query("objectSlug");
            const conditions = [
                eq(schema.recordFavorites.crmUserId, crmUserRow.id),
                eq(schema.recordFavorites.organizationId, crmUserRow.organizationId),
            ];
            if (objectSlug) {
                conditions.push(eq(schema.recordFavorites.objectSlug, objectSlug));
            }
            const favorites = await db
                .select()
                .from(schema.recordFavorites)
                .where(and(...conditions))
                .orderBy(asc(schema.recordFavorites.createdAt));
            return c.json(favorites);
        }
        catch (err) {
            console.error("[object-config] list favorites failed:", err);
            return c.json({ error: "Failed to load favorites" }, 500);
        }
    });
    // --- Dynamic :slug routes ---
    // PUT /:slug — Update object config (partial)
    app.put("/:slug", async (c) => {
        const slug = c.req.param("slug");
        const adminError = await requireObjectConfigWrite(c);
        if (adminError)
            return adminError;
        try {
            let rawBody;
            try {
                rawBody = await c.req.json();
            }
            catch {
                return c.json({ error: "Invalid JSON body" }, 400);
            }
            const parsed = objectConfigPutSchema.safeParse(rawBody);
            if (!parsed.success) {
                const msg = parsed.error.issues[0]?.message ?? "Validation failed";
                return c.json({ error: msg }, 400);
            }
            const body = parsed.data;
            const [existing] = await db
                .select()
                .from(schema.objectConfig)
                .where(eq(schema.objectConfig.slug, slug))
                .limit(1);
            if (!existing) {
                return c.json({ error: "Object config not found" }, 404);
            }
            // Build update object with only provided fields
            const updates = {};
            if (body.singularName !== undefined)
                updates.singularName = body.singularName;
            if (body.pluralName !== undefined)
                updates.pluralName = body.pluralName;
            if (body.icon !== undefined)
                updates.icon = body.icon;
            if (body.iconColor !== undefined)
                updates.iconColor = body.iconColor;
            if (body.tableName !== undefined)
                updates.tableName = body.tableName;
            if (body.type !== undefined)
                updates.type = body.type;
            if (body.isActive !== undefined)
                updates.isActive = body.isActive;
            if (body.position !== undefined)
                updates.position = body.position;
            if (body.settings !== undefined)
                updates.settings = body.settings;
            if (Object.keys(updates).length === 0) {
                return c.json(existing);
            }
            const [updated] = await db
                .update(schema.objectConfig)
                .set(updates)
                .where(eq(schema.objectConfig.slug, slug))
                .returning();
            if (updated) {
                const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
                if (authz.ok) {
                    await writeAuditLogSafe(db, {
                        crmUserId: authz.crmUser.id,
                        organizationId: authz.crmUser.organizationId,
                        action: "object_config.updated",
                        entityType: "object_config",
                        entityId: updated.id,
                        metadata: { slug, updatedFields: Object.keys(updates) },
                    });
                }
            }
            return c.json(updated);
        }
        catch (err) {
            console.error("[object-config] update failed:", err);
            return c.json({ error: "Failed to update object config" }, 500);
        }
    });
    // POST /:slug/overrides — Create/update attribute override (upsert by column_name)
    app.post("/:slug/overrides", async (c) => {
        const slug = c.req.param("slug");
        const adminError = await requireObjectConfigWrite(c);
        if (adminError)
            return adminError;
        try {
            let rawBody;
            try {
                rawBody = await c.req.json();
            }
            catch {
                return c.json({ error: "Invalid JSON body" }, 400);
            }
            const parsed = attributeOverridePostSchema.safeParse(rawBody);
            if (!parsed.success) {
                const msg = parsed.error.issues[0]?.message ?? "Validation failed";
                return c.json({ error: msg }, 400);
            }
            const body = parsed.data;
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
                .where(and(eq(schema.objectAttributeOverrides.objectConfigId, objConfig.id), eq(schema.objectAttributeOverrides.columnName, body.columnName)))
                .limit(1);
            if (existing) {
                // Update existing override
                const updates = {};
                if (body.displayName !== undefined)
                    updates.displayName = body.displayName;
                if (body.uiType !== undefined)
                    updates.uiType = body.uiType;
                if (body.icon !== undefined)
                    updates.icon = body.icon;
                if (body.isPrimary !== undefined)
                    updates.isPrimary = body.isPrimary;
                if (body.isHiddenByDefault !== undefined)
                    updates.isHiddenByDefault = body.isHiddenByDefault;
                if (body.config !== undefined)
                    updates.config = body.config;
                const [updated] = await db
                    .update(schema.objectAttributeOverrides)
                    .set(updates)
                    .where(eq(schema.objectAttributeOverrides.id, existing.id))
                    .returning();
                const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
                if (authz.ok && updated) {
                    await writeAuditLogSafe(db, {
                        crmUserId: authz.crmUser.id,
                        organizationId: authz.crmUser.organizationId,
                        action: "object_attribute_override.updated",
                        entityType: "object_attribute_override",
                        entityId: updated.id,
                        metadata: {
                            slug,
                            columnName: body.columnName,
                            updatedFields: Object.keys(updates),
                        },
                    });
                }
                return c.json(updated);
            }
            else {
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
                const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
                if (authz.ok && created) {
                    await writeAuditLogSafe(db, {
                        crmUserId: authz.crmUser.id,
                        organizationId: authz.crmUser.organizationId,
                        action: "object_attribute_override.created",
                        entityType: "object_attribute_override",
                        entityId: created.id,
                        metadata: { slug, columnName: body.columnName },
                    });
                }
                return c.json(created, 201);
            }
        }
        catch (err) {
            console.error("[object-config] override upsert failed:", err);
            return c.json({ error: "Failed to save attribute override" }, 500);
        }
    });
    return app;
}
