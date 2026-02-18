import type { Context, Next } from "hono";
import { db } from "@basicsos/db";
import { sql } from "drizzle-orm";

/**
 * After auth middleware sets ctx.auth, this middleware injects the tenant_id
 * into the PostgreSQL session variable for Row-Level Security policies.
 *
 * Must run AFTER authMiddleware.
 */
export const tenantMiddleware = async (c: Context, next: Next): Promise<void> => {
  const auth = c.get("auth");
  if (auth?.tenantId) {
    // SET LOCAL scopes the variable to the current transaction only
    await db.execute(sql`SET LOCAL app.tenant_id = ${auth.tenantId}`);
  }
  await next();
};
