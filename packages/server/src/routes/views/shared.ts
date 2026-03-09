import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";

export async function getCrmUserId(
  db: Db,
  session: { user?: { id: string } },
): Promise<{ crmUserId: number; organizationId: string } | null> {
  if (!session?.user?.id) return null;
  const [row] = await db
    .select({
      id: schema.crmUsers.id,
      organizationId: schema.crmUsers.organizationId,
    })
    .from(schema.crmUsers)
    .where(eq(schema.crmUsers.userId, session.user.id))
    .limit(1);
  if (!row?.id || !row.organizationId) return null;
  return { crmUserId: row.id, organizationId: row.organizationId };
}

export async function getViewAndCheckOwnership(
  db: Db,
  viewId: string,
  crmUserId: number,
  organizationId: string,
): Promise<typeof schema.views.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(schema.views)
    .where(
      and(
        eq(schema.views.id, viewId),
        eq(schema.views.crmUserId, crmUserId),
        eq(schema.views.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function formatColumnTitle(columnName: string): string {
  if (/[_]/.test(columnName) || /^[A-Z_]+$/.test(columnName)) {
    return columnName
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return columnName;
}

async function getColumnListForTable(
  db: Db,
  baseTable: string,
  organizationId: string,
): Promise<{ fieldId: string; title: string }[]> {
  const result = await db.execute(
    sql`SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${baseTable}
        ORDER BY ordinal_position`,
  );
  const raw = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  const rows = raw as { column_name: string }[];

  // Look up attribute overrides so view columns get correct display names
  const overrides = await db
    .select({
      columnName: schema.objectAttributeOverrides.columnName,
      displayName: schema.objectAttributeOverrides.displayName,
    })
    .from(schema.objectAttributeOverrides)
    .innerJoin(
      schema.objectConfig,
      eq(
        schema.objectAttributeOverrides.objectConfigId,
        schema.objectConfig.id,
      ),
    )
    .where(
      and(
        eq(schema.objectConfig.tableName, baseTable),
        or(
          eq(schema.objectAttributeOverrides.organizationId, organizationId),
          isNull(schema.objectAttributeOverrides.organizationId),
        ),
      ),
    );
  const overrideMap = new Map(
    overrides
      .filter((o) => o.displayName)
      .map((o) => [o.columnName, o.displayName!]),
  );

  const out: { fieldId: string; title: string }[] = rows.map((r) => ({
    fieldId: r.column_name,
    title: overrideMap.get(r.column_name) ?? formatColumnTitle(r.column_name),
  }));

  const customRows = await db
    .select()
    .from(schema.customFieldDefs)
    .where(
      and(
        eq(schema.customFieldDefs.resource, baseTable),
        or(
          eq(schema.customFieldDefs.organizationId, organizationId),
          isNull(schema.customFieldDefs.organizationId),
        ),
      ),
    )
    .orderBy(
      asc(schema.customFieldDefs.position),
      asc(schema.customFieldDefs.id),
    );
  for (const def of customRows) {
    out.push({ fieldId: `custom_${def.id}`, title: def.label });
  }
  return out;
}

export async function copyViewColumns(
  db: Db,
  sourceViewId: string,
  targetViewId: string,
): Promise<void> {
  const sourceCols = await db
    .select()
    .from(schema.viewColumns)
    .where(eq(schema.viewColumns.viewId, sourceViewId))
    .orderBy(asc(schema.viewColumns.displayOrder), asc(schema.viewColumns.id));
  if (sourceCols.length === 0) return;
  await db.insert(schema.viewColumns).values(
    sourceCols.map((c) => ({
      viewId: targetViewId,
      fieldId: c.fieldId,
      title: c.title,
      show: c.show,
      displayOrder: c.displayOrder,
    })),
  );
}

export async function seedDefaultViewColumns(
  db: Db,
  viewId: string,
  objectSlug: string,
  organizationId: string,
): Promise<void> {
  const [objConfig] = await db
    .select({ tableName: schema.objectConfig.tableName })
    .from(schema.objectConfig)
    .where(eq(schema.objectConfig.slug, objectSlug))
    .limit(1);
  if (!objConfig) return;
  const columns = await getColumnListForTable(
    db,
    objConfig.tableName,
    organizationId,
  );
  if (columns.length === 0) return;
  await db.insert(schema.viewColumns).values(
    columns.map((col, i) => ({
      viewId,
      fieldId: col.fieldId,
      title: col.title,
      show: col.fieldId !== "id",
      displayOrder: i,
    })),
  );
}
