// Per-user timezone (and org-default) for scheduled automations.
// resolveTimezone() uses crm_users.timezone -> organizations.timezone -> UTC,
// so "every Monday 9am" fires at the user's LOCAL 9am once their tz is known.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import { authMiddleware } from "@/middleware/auth.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import * as schema from "@/db/schema/index.js";

type Auth = ReturnType<typeof createAuth>;

const isValidTz = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export function createMeRoutes(db: Db, auth: Auth, env: Env) {
  const app = new Hono();

  /** Effective timezone (the user's, the org default, and what actually applies). */
  app.get("/timezone", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const user = authz.crmUser;
    let orgTz: string | null = null;
    if (user.organizationId) {
      const [org] = await db
        .select({ tz: schema.organizations.timezone })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, user.organizationId))
        .limit(1);
      orgTz = org?.tz ?? null;
    }
    return c.json({ user: user.timezone ?? null, org: orgTz, effective: user.timezone ?? orgTz ?? "UTC" });
  });

  /** Set the current user's timezone. Auto-detect sends `force:false` (only sets
   *  if unset); an explicit Settings change sends `force:true`. */
  app.post("/timezone", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const body = (await c.req.json().catch(() => ({}))) as { timezone?: string; force?: boolean };
    const tz = String(body.timezone ?? "").trim();
    if (!tz || !isValidTz(tz)) return c.json({ error: "Invalid timezone" }, 400);
    if (authz.crmUser.timezone && body.force !== true) {
      return c.json({ ok: true, timezone: authz.crmUser.timezone, changed: false });
    }
    await db.update(schema.crmUsers).set({ timezone: tz }).where(eq(schema.crmUsers.id, authz.crmUser.id));
    return c.json({ ok: true, timezone: tz, changed: true });
  });

  /** Set the org default timezone (the fallback). Requires config-write. */
  app.put("/org-timezone", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.objectConfigWrite);
    if (!authz.ok) return authz.response;
    if (!authz.crmUser.organizationId) return c.json({ error: "No organization" }, 400);
    const body = (await c.req.json().catch(() => ({}))) as { timezone?: string };
    const tz = String(body.timezone ?? "").trim();
    if (!tz || !isValidTz(tz)) return c.json({ error: "Invalid timezone" }, 400);
    await db
      .update(schema.organizations)
      .set({ timezone: tz })
      .where(eq(schema.organizations.id, authz.crmUser.organizationId));
    return c.json({ ok: true, timezone: tz });
  });

  return app;
}
