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
  and,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

export function snakeToCamelField(field: string): string {
  return field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Escape % and _ for use in SQL ILIKE patterns (they are wildcards). */
function escapeIlikeValue(value: string): string {
  return value.replace(/[%_\\]/g, (char) =>
    char === "\\" ? "\\\\" : `\\${char}`,
  );
}

export interface GenericFilter {
  field: string;
  op: string;
  value: string;
  logicalOp?: "and" | "or";
}

export function buildGenericFilterCondition(
  table: PgTableWithColumns<any>,
  f: GenericFilter,
): SQL | null {
  const columnKey = snakeToCamelField(f.field);
  const col = (table as Record<string, unknown>)[columnKey];
  const hasColumn =
    !!col && typeof (col as { getSQL: unknown }).getSQL === "function";
  const hasCustomFieldsColumn =
    typeof (
      (table as Record<string, unknown>).customFields as
        | { getSQL?: unknown }
        | undefined
    )?.getSQL === "function";

  const rawExpr = hasColumn
    ? (col as SQL)
    : hasCustomFieldsColumn
      ? sql`(${(table as Record<string, unknown>).customFields as SQL} ->> ${f.field})`
      : null;

  if (!rawExpr) return null;

  const normalizedOp =
    f.op === "contains"
      ? "like"
      : f.op === "not_contains"
        ? "nlike"
        : f.op === "is_empty"
          ? "blank"
          : f.op === "is_not_empty"
            ? "notblank"
            : f.op;

  switch (normalizedOp) {
    case "eq":
      return eq(rawExpr, f.value);
    case "neq":
      return ne(rawExpr, f.value);
    case "like":
      return ilike(rawExpr, `%${escapeIlikeValue(f.value)}%`);
    case "nlike":
      return not(ilike(rawExpr, `%${escapeIlikeValue(f.value)}%`));
    case "gt":
      return gt(rawExpr, f.value);
    case "lt":
      return lt(rawExpr, f.value);
    case "gte":
      return gte(rawExpr, f.value);
    case "lte":
      return lte(rawExpr, f.value);
    case "blank":
      return hasColumn ? isNull(rawExpr) : (or(isNull(rawExpr), eq(rawExpr, "")) ?? null);
    case "notblank":
      return hasColumn
        ? isNotNull(rawExpr)
        : (and(isNotNull(rawExpr), ne(rawExpr, "")) ?? null);
    default:
      return null;
  }
}
