import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import {
  runPostSchema,
  runsListQuerySchema,
} from "@/schemas/automation-runs.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import { eq, and, desc } from "drizzle-orm";
import { triggerRunNow } from "@/lib/automation-engine.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

export function createAutomationRunsRoutes(
  db: Db,
  auth: BetterAuthInstance,
  _env: Env,
) {
  const app = new Hono();

  app.use("*", authMiddleware(auth, db));

  // POST /api/automation-runs/run — trigger manual run for a rule
  app.post("/run", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = runPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const ruleId = parsed.data.ruleId;

    const session = c.get("session") as { user?: { id: string } };
    const [crmUserRow] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, session.user!.id))
      .limit(1);
    if (!crmUserRow) return c.json({ error: "User not found in CRM" }, 404);

    const [rule] = await db
      .select()
      .from(schema.automationRules)
      .where(
        and(
          eq(schema.automationRules.id, ruleId),
          eq(schema.automationRules.crmUserId, crmUserRow.id),
        ),
      )
      .limit(1);
    if (!rule) return c.json({ error: "Rule not found" }, 404);

    const ok = await triggerRunNow(ruleId, crmUserRow.id);
    if (!ok) return c.json({ error: "Failed to trigger run" }, 500);
    return c.json({ triggered: true });
  });

  // GET /api/automation-runs?ruleId=X&limit=N
  // When ruleId omitted: returns org-wide recent runs (for home activity feed).
  app.get("/", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const queryParsed = runsListQuerySchema.safeParse({
      ruleId: c.req.query("ruleId"),
      limit: c.req.query("limit"),
    });
    if (!queryParsed.success) {
      const msg =
        queryParsed.error.issues[0]?.message ?? "Invalid query params";
      return c.json({ error: msg }, 400);
    }

    const session = c.get("session") as { user?: { id: string } };
    const [crmUserRow] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, session.user!.id))
      .limit(1);
    if (!crmUserRow) return c.json({ error: "User not found in CRM" }, 404);

    const limit = queryParsed.data.limit ?? 20;
    const ruleIdParam = queryParsed.data.ruleId;
    const ruleId =
      ruleIdParam != null && ruleIdParam !== ""
        ? parseInt(ruleIdParam, 10)
        : null;

    if (ruleId != null && !isNaN(ruleId)) {
      // Single-rule runs (existing behavior)
      const [rule] = await db
        .select()
        .from(schema.automationRules)
        .where(
          and(
            eq(schema.automationRules.id, ruleId),
            eq(schema.automationRules.crmUserId, crmUserRow.id),
          ),
        )
        .limit(1);
      if (!rule) return c.json({ error: "Rule not found" }, 404);

      const runs = await db
        .select()
        .from(schema.automationRuns)
        .where(eq(schema.automationRuns.ruleId, ruleId))
        .orderBy(desc(schema.automationRuns.startedAt))
        .limit(limit);

      return c.json(runs);
    }

    // Org-wide recent runs (for home activity feed)
    const orgId = crmUserRow.organizationId;
    if (!orgId) return c.json({ error: "Organization not found" }, 404);

    const runs = await db
      .select({
        id: schema.automationRuns.id,
        ruleId: schema.automationRuns.ruleId,
        status: schema.automationRuns.status,
        result: schema.automationRuns.result,
        error: schema.automationRuns.error,
        startedAt: schema.automationRuns.startedAt,
        finishedAt: schema.automationRuns.finishedAt,
        ruleName: schema.automationRules.name,
      })
      .from(schema.automationRuns)
      .innerJoin(
        schema.automationRules,
        eq(schema.automationRuns.ruleId, schema.automationRules.id),
      )
      .where(eq(schema.automationRuns.organizationId, orgId))
      .orderBy(desc(schema.automationRuns.startedAt))
      .limit(limit);

    return c.json(runs);
  });

  return app;
}
