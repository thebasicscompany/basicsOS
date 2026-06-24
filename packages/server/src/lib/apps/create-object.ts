import { sql, eq, and, or, isNull } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { notifyToolsListChanged } from "@/mcp-broker/tool-change-bus.js";

export interface CreateObjectField {
  name: string;
  label: string;
  fieldType: string;
  options?: unknown;
}

export interface CreateObjectInput {
  singularName: string;
  pluralName: string;
  icon?: string;
  iconColor?: string;
  fields?: CreateObjectField[];
}

export interface CreatedObject {
  id: number;
  slug: string;
  tableName: string;
  existed: boolean;
}

const toSlug = (pluralName: string) =>
  pluralName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/**
 * Create a custom object (grid) — its backing `custom_<slug>` table, object_config
 * row, a primary "name" attribute, and any initial fields — and live-notify the
 * agent. Shared so the app builder can auto-scaffold a structured, agent-readable
 * store for a data app instead of dumping records into opaque app storage. Returns
 * the existing object (existed:true) if the slug is already taken.
 */
export async function createCustomObject(
  db: Db,
  orgId: string,
  input: CreateObjectInput,
): Promise<CreatedObject> {
  const slug = toSlug(input.pluralName) || "records";
  const tableName = `custom_${slug}`;

  // Scope the existence check to THIS org (plus NULL-org system objects) so a
  // slug another org already uses can't cross-resolve and silently reuse their
  // object.
  const [existing] = await db
    .select()
    .from(schema.objectConfig)
    .where(
      and(
        eq(schema.objectConfig.slug, slug),
        or(eq(schema.objectConfig.organizationId, orgId), isNull(schema.objectConfig.organizationId)),
      ),
    )
    .limit(1);
  if (existing) return { id: existing.id, slug, tableName: existing.tableName, existed: true };

  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(255),
      crm_user_id BIGINT,
      organization_id UUID,
      custom_fields JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS ${sql.identifier(`idx_${tableName}_org`)} ON ${sql.identifier(tableName)} (organization_id)`,
  );

  const [maxPos] = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(position), 0)` })
    .from(schema.objectConfig);
  const nextPosition = (maxPos?.maxPos ?? 0) + 1;

  const [created] = await db
    .insert(schema.objectConfig)
    .values({
      slug,
      singularName: input.singularName,
      pluralName: input.pluralName,
      icon: input.icon ?? "Table",
      iconColor: input.iconColor,
      tableName,
      type: "standard",
      isActive: true,
      position: nextPosition,
      settings: {},
      organizationId: orgId,
    })
    .returning();

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
    if (input.fields?.length) {
      await db.insert(schema.customFieldDefs).values(
        input.fields.map((f, i) => ({
          resource: tableName,
          name: f.name,
          label: f.label,
          fieldType: f.fieldType,
          options: (f.options ?? null) as never,
          position: i + 1,
          organizationId: orgId,
        })),
      );
    }
  }

  notifyToolsListChanged();
  return { id: created?.id ?? 0, slug, tableName, existed: false };
}
