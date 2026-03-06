/**
 * Raw-SQL helpers for custom object tables that aren't in the static Drizzle schema.
 * These tables are created dynamically via POST /api/object-config and follow
 * a standard shape: id, name, crm_user_id, organization_id, custom_fields, created_at, updated_at.
 */

import { sql } from "drizzle-orm";
import { eq, and, or, isNull } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";

/**
 * Check if a resource is a custom object by looking it up in object_config.
 * Returns the table name if found, null otherwise.
 */
export async function resolveCustomTable(
  db: Db,
  resource: string,
  orgId: string,
): Promise<string | null> {
  // Custom tables use slug as the resource name; the actual table is custom_<slug>
  const [obj] = await db
    .select({ tableName: schema.objectConfig.tableName })
    .from(schema.objectConfig)
    .where(
      and(
        eq(schema.objectConfig.slug, resource),
        or(
          eq(schema.objectConfig.organizationId, orgId),
          isNull(schema.objectConfig.organizationId),
        ),
      ),
    )
    .limit(1);

  if (!obj) return null;
  // Only handle dynamically created tables (custom_ prefix)
  if (!obj.tableName.startsWith("custom_")) return null;
  return obj.tableName;
}

export async function listCustomRecords(
  db: Db,
  tableName: string,
  orgId: string,
  opts: {
    limit: number;
    offset: number;
    sort?: string | null;
    order?: string | null;
  },
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const table = sql.identifier(tableName);

  // Count
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS count FROM ${table} WHERE organization_id = ${orgId}`,
  );
  const countRows = Array.isArray(countResult)
    ? countResult
    : ((countResult as { rows?: unknown[] }).rows ?? []);
  const total = (countRows[0] as { count: number })?.count ?? 0;

  // Sort
  let orderClause = sql`ORDER BY created_at DESC`;
  if (opts.sort) {
    const dir = opts.order === "ASC" ? sql`ASC` : sql`DESC`;
    orderClause = sql`ORDER BY ${sql.identifier(opts.sort)} ${dir}`;
  }

  const result = await db.execute(
    sql`SELECT * FROM ${table} WHERE organization_id = ${orgId} ${orderClause} LIMIT ${opts.limit} OFFSET ${opts.offset}`,
  );
  const rows = (
    Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
  ) as Record<string, unknown>[];

  return { rows, total };
}

export async function getCustomRecord(
  db: Db,
  tableName: string,
  orgId: string,
  id: number,
): Promise<Record<string, unknown> | null> {
  const table = sql.identifier(tableName);
  const result = await db.execute(
    sql`SELECT * FROM ${table} WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`,
  );
  const rows = (
    Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
  ) as Record<string, unknown>[];
  return rows[0] ?? null;
}

export async function insertCustomRecord(
  db: Db,
  tableName: string,
  body: Record<string, unknown>,
  crmUserId: number,
  orgId: string,
): Promise<Record<string, unknown> | null> {
  const table = sql.identifier(tableName);

  // Separate "name" from custom fields
  const name = (body.name ?? body.Name ?? null) as string | null;
  const customFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === "name" || k === "Name") continue;
    if (k === "id" || k === "Id") continue;
    customFields[k] = v;
  }

  const result = await db.execute(
    sql`INSERT INTO ${table} (name, crm_user_id, organization_id, custom_fields)
        VALUES (${name}, ${crmUserId}, ${orgId}, ${JSON.stringify(customFields)}::jsonb)
        RETURNING *`,
  );
  const rows = (
    Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
  ) as Record<string, unknown>[];
  return rows[0] ?? null;
}

export async function updateCustomRecord(
  db: Db,
  tableName: string,
  id: number,
  orgId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const table = sql.identifier(tableName);

  // Separate "name" from custom fields
  const name = body.name ?? body.Name;
  const customFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === "name" || k === "Name" || k === "id" || k === "Id") continue;
    customFields[k] = v;
  }

  if (name !== undefined) {
    await db.execute(
      sql`UPDATE ${table} SET name = ${name as string}, custom_fields = custom_fields || ${JSON.stringify(customFields)}::jsonb, updated_at = NOW() WHERE id = ${id} AND organization_id = ${orgId}`,
    );
  } else {
    await db.execute(
      sql`UPDATE ${table} SET custom_fields = custom_fields || ${JSON.stringify(customFields)}::jsonb, updated_at = NOW() WHERE id = ${id} AND organization_id = ${orgId}`,
    );
  }

  return getCustomRecord(db, tableName, orgId, id);
}

export async function deleteCustomRecord(
  db: Db,
  tableName: string,
  id: number,
  orgId: string,
): Promise<boolean> {
  const table = sql.identifier(tableName);
  await db.execute(
    sql`DELETE FROM ${table} WHERE id = ${id} AND organization_id = ${orgId}`,
  );
  return true;
}
