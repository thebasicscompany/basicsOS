import {
  eq,
  ne,
  not,
  ilike,
  gt,
  lt,
  gte,
  lte,
  isNull,
  isNotNull,
  type SQL,
} from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

export function snakeToCamelField(field: string): string {
  return field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Escape % and _ for use in SQL ILIKE patterns (they are wildcards). */
function escapeIlikeValue(value: string): string {
  return value.replace(/[%_\\]/g, (char) => (char === "\\" ? "\\\\" : `\\${char}`));
}

export interface GenericFilter {
  field: string;
  op: string;
  value: string;
}

export function buildGenericFilterCondition(
  table: PgTableWithColumns<any>,
  f: GenericFilter,
): SQL | null {
  const col = (table as Record<string, unknown>)[snakeToCamelField(f.field)];
  if (!col || typeof (col as { getSQL: unknown }).getSQL !== "function")
    return null;
  const c = col as SQL;
  switch (f.op) {
    case "eq":
      return eq(c, f.value);
    case "neq":
      return ne(c, f.value);
    case "like":
      return ilike(c, `%${escapeIlikeValue(f.value)}%`);
    case "nlike":
      return not(ilike(c, `%${escapeIlikeValue(f.value)}%`));
    case "gt":
      return gt(c, f.value);
    case "lt":
      return lt(c, f.value);
    case "gte":
      return gte(c, f.value);
    case "lte":
      return lte(c, f.value);
    case "blank":
      return isNull(c);
    case "notblank":
      return isNotNull(c);
    default:
      return null;
  }
}
