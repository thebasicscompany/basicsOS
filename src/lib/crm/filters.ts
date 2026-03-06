/**
 * Translate frontend filter objects to `where` query syntax.
 *
 * Filter syntax:
 *   Simple:  (field_name,eq,value)
 *   Combine: (field1,eq,val1)~and(field2,gt,val2)
 *   Like:    (field_name,like,%value%)
 *   Null:    (field,is,null) / (field,isnot,null)
 */

/** Resource-specific searchable fields for full-text `q` filter */
const SEARCH_FIELDS: Record<string, string[]> = {
  contacts: ["first_name", "last_name", "email"],
  contacts_summary: ["first_name", "last_name", "email"],
  companies: ["name", "category"],
  companies_summary: ["name", "category"],
  deals: ["name"],
  tasks: ["text"],
  contact_notes: ["text"],
  deal_notes: ["text"],
  tags: ["name"],
  crm_users: ["first_name", "last_name", "email"],
};

export function buildWhereClause(
  filter: Record<string, unknown>,
  resource: string,
  crmUserId?: number,
): string {
  const clauses: string[] = [];

  // Always inject crmUserId scoping for multi-tenancy.
  if (crmUserId != null) {
    clauses.push(`(crm_user_id,eq,${crmUserId})`);
  }

  for (const [key, value] of Object.entries(filter)) {
    if (value == null || value === "") continue;

    // Full-text search: translate `q` to LIKE on searchable fields
    if (key === "q" && typeof value === "string" && value.trim()) {
      const fields = SEARCH_FIELDS[resource] ?? [];
      if (fields.length > 0) {
        const qClauses = fields.map(
          (f) => `(${f},like,%${value.trim()}%)`,
        );
        // Wrap OR group — NocoDB uses ~or between conditions
        clauses.push(qClauses.join("~or"));
      }
      continue;
    }

    // Standard equality filter (supports snake_case keys from frontend)
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    clauses.push(`(${snakeKey},eq,${value})`);
  }

  return clauses.join("~and");
}

/** Build NocoDB sort string from sort field + order */
export function buildSortParam(
  field?: string,
  order?: "ASC" | "DESC",
): string | undefined {
  if (!field) return undefined;
  const snakeField = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  return order === "DESC" ? `-${snakeField}` : snakeField;
}

export interface SortDef {
  field: string;
  direction: "asc" | "desc";
}

/** Build multi-sort param: e.g. "-field1,field2" */
export function buildMultiSortParam(sorts: SortDef[]): string | undefined {
  if (!sorts.length) return undefined;
  return sorts
    .map((s) => {
      const snakeField = s.field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      return s.direction === "desc" ? `-${snakeField}` : snakeField;
    })
    .join(",");
}

export type FilterOp =
  | "eq"
  | "neq"
  | "like"
  | "nlike"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "is"
  | "isnot"
  | "blank"
  | "notblank";

export interface FilterDef {
  field: string;
  op: FilterOp;
  value: string;
}

/** Build NocoDB where clause from structured filter definitions */
export function buildFilterParam(filters: FilterDef[]): string {
  if (!filters.length) return "";
  return filters
    .map((f) => {
      const snakeField = f.field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      if (f.op === "blank") return `(${snakeField},is,null)`;
      if (f.op === "notblank") return `(${snakeField},isnot,null)`;
      if (f.op === "like" || f.op === "nlike") {
        return `(${snakeField},${f.op},%${f.value}%)`;
      }
      return `(${snakeField},${f.op},${f.value})`;
    })
    .join("~and");
}
