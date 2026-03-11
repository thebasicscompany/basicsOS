import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import {
  resolveOrgAiConfig,
  buildGatewayHeaders,
} from "@/lib/org-ai-config.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

export function createEnrichmentRoutes(
  db: Db,
  auth: BetterAuthInstance,
  env: Env,
) {
  const app = new Hono();

  // Helper to get crmUser for the current session (same pattern as meetings.ts)
  const getCrmUser = async (c: { get: (k: string) => unknown }) => {
    const session = c.get("session") as
      | { user?: { id?: string } }
      | undefined;
    const userId = session?.user?.id;
    if (!userId) return null;

    const [crmUser] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);
    return crmUser ?? null;
  };

  // POST /api/enrichment/enrich — trigger single enrichment
  app.post("/enrich", authMiddleware(auth, db), async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) {
      return c.json({ error: "Organization not found" }, 404);
    }

    const body = await c.req.json<{
      entityType: "contact" | "company";
      entityId: number;
    }>();

    if (!body.entityType || !body.entityId) {
      return c.json({ error: "entityType and entityId required" }, 400);
    }

    try {
      const orgAi = await resolveOrgAiConfig(c, db, env);
      if (!orgAi.ok) return orgAi.response;
      const gatewayHeaders = buildGatewayHeaders(orgAi.data.aiConfig);

      const { enrichEntity } = await import("../lib/enrichment/engine.js");
      const result = await enrichEntity({
        db,
        organizationId: crmUser.organizationId,
        crmUserId: crmUser.id,
        entityType: body.entityType,
        entityId: body.entityId,
        gatewayUrl: env.BASICSOS_API_URL,
        gatewayHeaders,
        env: env as unknown as Record<string, string>,
      });

      return c.json(result);
    } catch (err) {
      console.error("[enrichment] error:", err);
      return c.json(
        { error: (err as Error).message || "Enrichment failed" },
        500,
      );
    }
  });

  // GET /api/enrichment/jobs — list enrichment jobs
  app.get("/jobs", authMiddleware(auth, db), async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) {
      return c.json({ error: "Organization not found" }, 404);
    }

    try {
      // Dynamic import: enrichment schema tables may not exist yet
      const enrichmentJobs = (schema as Record<string, unknown>)
        .enrichmentJobs as typeof schema.crmUsers | undefined;
      if (!enrichmentJobs) return c.json([], 200);

      const jobs = await db
        .select()
        .from(enrichmentJobs)
        .where(eq((enrichmentJobs as any).organizationId, crmUser.organizationId))
        .orderBy(desc((enrichmentJobs as any).createdAt))
        .limit(50);
      return c.json(jobs);
    } catch {
      return c.json([], 200);
    }
  });

  // GET /api/enrichment/credits — get credit balance
  app.get("/credits", authMiddleware(auth, db), async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) {
      return c.json({ error: "Organization not found" }, 404);
    }

    try {
      const enrichmentCredits = (schema as Record<string, unknown>)
        .enrichmentCredits as typeof schema.crmUsers | undefined;
      if (!enrichmentCredits)
        return c.json({ monthlyLimit: 100, usedThisMonth: 0 });

      const [credits] = await db
        .select()
        .from(enrichmentCredits)
        .where(
          eq(
            (enrichmentCredits as any).organizationId,
            crmUser.organizationId,
          ),
        );
      return c.json(
        credits ?? {
          monthlyLimit: 100,
          usedThisMonth: 0,
        },
      );
    } catch {
      return c.json({ monthlyLimit: 100, usedThisMonth: 0 });
    }
  });

  return app;
}
