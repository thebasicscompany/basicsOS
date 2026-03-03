import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import type { createAuth } from "../auth.js";
import * as schema from "../db/schema/index.js";
import { eq, and, desc } from "drizzle-orm";
import { triggerRunNow } from "../lib/automation-engine.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

export function createAutomationRunsRoutes(db: Db, auth: BetterAuthInstance, _env: Env) {
  const app = new Hono();

  app.use("*", authMiddleware(auth));

  // POST /api/automation-runs/run — trigger manual run for a rule
  app.post("/run", async (c) => {
    const body = await c.req.json<{ ruleId: number }>().catch(() => ({}));
    const ruleId = body?.ruleId;
    if (typeof ruleId !== "number") return c.json({ error: "ruleId required" }, 400);

    const session = c.get("session") as { user?: { id: string } };
    const [salesRow] = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);
    if (!salesRow) return c.json({ error: "User not found in CRM" }, 404);

    const [rule] = await db
      .select()
      .from(schema.automationRules)
      .where(and(eq(schema.automationRules.id, ruleId), eq(schema.automationRules.salesId, salesRow.id)))
      .limit(1);
    if (!rule) return c.json({ error: "Rule not found" }, 404);

    const ok = await triggerRunNow(ruleId, salesRow.id);
    if (!ok) return c.json({ error: "Failed to trigger run" }, 500);
    return c.json({ triggered: true });
  });

  // GET /api/automation-runs?ruleId=X
  app.get("/", async (c) => {
    const ruleIdParam = c.req.query("ruleId");
    if (!ruleIdParam) return c.json({ error: "ruleId query param required" }, 400);

    const ruleId = parseInt(ruleIdParam, 10);
    if (isNaN(ruleId)) return c.json({ error: "Invalid ruleId" }, 400);

    const session = c.get("session") as { user?: { id: string } };
    const [salesRow] = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);
    if (!salesRow) return c.json({ error: "User not found in CRM" }, 404);

    // Verify rule belongs to this user
    const [rule] = await db
      .select()
      .from(schema.automationRules)
      .where(and(eq(schema.automationRules.id, ruleId), eq(schema.automationRules.salesId, salesRow.id)))
      .limit(1);
    if (!rule) return c.json({ error: "Rule not found" }, 404);

    const limitParam = c.req.query("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

    const runs = await db
      .select()
      .from(schema.automationRuns)
      .where(eq(schema.automationRuns.ruleId, ruleId))
      .orderBy(desc(schema.automationRuns.startedAt))
      .limit(limit);

    return c.json(runs);
  });

  return app;
}
