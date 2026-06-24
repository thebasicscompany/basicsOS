// ScopedDb (APP-4c): the org-filtered DB accessor handed to an app module. The
// security property: a module can touch ONLY its own namespaced tables
// (`app_{slug}_*`) and NEVER core tables (crm_users, contacts, deals, auth, etc.).
// Modules reach core data through the broker (permission-gated), not raw SQL.
//
// `assertAppScopedSql` is the pure guard (unit-tested without a DB). It extracts
// every table identifier following FROM / JOIN / INTO / UPDATE / TABLE and rejects
// the query unless every one is prefixed `app_{slug}_`. A hard core-table denylist
// is a second line of defense. Fail-closed: if we can't prove a reference is an
// app table, we reject.

import type { RawSql } from "@/db/client.js";
import type { ScopedDb } from "@/apps/module-types.js";

/** Core tables a module must never reach directly (belt-and-suspenders alongside
 *  the app-prefix allowlist). Not exhaustive by design — the allowlist is primary. */
const CORE_TABLE_DENYLIST = new Set([
  "user",
  "session",
  "account",
  "verification",
  "organizations",
  "crm_users",
  "crm_api_tokens",
  "contacts",
  "companies",
  "deals",
  "tasks",
  "contact_notes",
  "deal_notes",
  "company_notes",
  "object_config",
  "object_attribute_overrides",
  "custom_field_defs",
  "app_config",
  "app_storage",
  "rbac_roles",
  "rbac_permissions",
  "rbac_user_roles",
  "rbac_role_permissions",
  "audit_logs",
  "ai_memory_items",
  "context_embeddings",
  "automation_rules",
  "automation_runs",
]);

// Table identifiers following a table-introducing keyword. Handles optional schema
// qualifier and quotes: FROM "public".my_table  /  JOIN app_x_y  /  UPDATE app_x_z
const TABLE_REF_RE =
  /\b(?:from|join|into|update|table)\s+(?:"?[a-z_][a-z0-9_]*"?\.)?"?([a-z_][a-z0-9_]*)"?/gi;

/** App-table prefix for a given app slug (slug sanitized to table-identifier chars). */
export function appTablePrefix(slug: string): string {
  return `app_${slug.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_`;
}

/**
 * Throw unless every table the query references belongs to this app
 * (`app_{slug}_*`) and is not a core table. Pure — no DB access.
 */
export function assertAppScopedSql(query: string, slug: string): void {
  if (typeof query !== "string" || query.length === 0) {
    throw new ScopedDbError("Empty query.");
  }
  // Strip string literals so table-like words inside strings don't trip detection
  // AND can't be used to smuggle a core table name past the allowlist check below.
  const stripped = query.replace(/'(?:[^']|'')*'/g, "''");
  const prefix = appTablePrefix(slug);

  let m: RegExpExecArray | null;
  let sawTable = false;
  TABLE_REF_RE.lastIndex = 0;
  while ((m = TABLE_REF_RE.exec(stripped)) !== null) {
    sawTable = true;
    const table = m[1].toLowerCase();
    if (CORE_TABLE_DENYLIST.has(table)) {
      throw new ScopedDbError(`Access to core table "${table}" is denied.`);
    }
    if (!table.startsWith(prefix)) {
      throw new ScopedDbError(
        `Table "${table}" is outside this app's namespace ("${prefix}*").`,
      );
    }
  }
  if (!sawTable) {
    // No recognizable table reference → reject (fail-closed): we can't prove safety.
    throw new ScopedDbError("Query references no app-scoped table.");
  }
  // Block multi-statement smuggling (a second statement could hit a core table).
  if (stripped.replace(/;\s*$/, "").includes(";")) {
    throw new ScopedDbError("Multiple statements are not allowed.");
  }
}

export class ScopedDbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopedDbError";
  }
}

/** Build a ScopedDb for an app module over the raw postgres.js client. */
export function createScopedDb(sql: RawSql, tenantId: string, slug: string): ScopedDb {
  return {
    tenantId,
    async query<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
      assertAppScopedSql(query, slug);
      // Parameterized raw execution ($1, $2, …) — values never concatenated.
      const rows = await sql.unsafe(query, params as never[]);
      return rows as unknown as T[];
    },
  };
}
