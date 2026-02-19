import { z } from "zod";
import { desc, eq, sql, sum } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc.js";
import { tenants, llmUsageLogs, auditLog, users } from "@basicsos/db";

export const adminRouter = router({
  getBranding: adminProcedure.query(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .select({
        id: tenants.id,
        name: tenants.name,
        logoUrl: tenants.logoUrl,
        accentColor: tenants.accentColor,
        plan: tenants.plan,
      })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId));

    if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
    return tenant;
  }),

  updateBranding: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128).optional(),
        logoUrl: z.string().url().optional().nullable(),
        accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const update: Partial<{ name: string; logoUrl: string | null; accentColor: string }> = {};
      if (input.name !== undefined) update.name = input.name;
      if (input.logoUrl !== undefined) update.logoUrl = input.logoUrl;
      if (input.accentColor !== undefined) update.accentColor = input.accentColor;

      if (Object.keys(update).length === 0) {
        const [tenant] = await ctx.db.select().from(tenants).where(eq(tenants.id, ctx.tenantId));
        if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });
        return tenant;
      }

      const [updated] = await ctx.db
        .update(tenants)
        .set(update)
        .where(eq(tenants.id, ctx.tenantId))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  getUsageStats: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregate token totals for the current calendar month
    const [totals] = await ctx.db
      .select({
        requestsThisMonth: sql<number>`count(*)::int`,
        tokensThisMonth: sum(llmUsageLogs.totalTokens),
        promptTokens: sum(llmUsageLogs.promptTokens),
        completionTokens: sum(llmUsageLogs.completionTokens),
      })
      .from(llmUsageLogs)
      .where(
        sql`${llmUsageLogs.tenantId} = ${ctx.tenantId} AND ${llmUsageLogs.createdAt} >= ${startOfMonth}`,
      );

    // Most recent 10 calls for the activity table
    const recentRows = await ctx.db
      .select({
        model: llmUsageLogs.model,
        totalTokens: llmUsageLogs.totalTokens,
        featureName: llmUsageLogs.featureName,
        createdAt: llmUsageLogs.createdAt,
        userId: llmUsageLogs.userId,
      })
      .from(llmUsageLogs)
      .where(eq(llmUsageLogs.tenantId, ctx.tenantId))
      .orderBy(desc(llmUsageLogs.createdAt))
      .limit(10);

    // Estimate cost at $3 / 1M input tokens + $15 / 1M output tokens (Sonnet pricing)
    const promptK = Number(totals?.promptTokens ?? 0);
    const completionK = Number(totals?.completionTokens ?? 0);
    const estimatedCostUsd = (promptK * 3 + completionK * 15) / 1_000_000;

    return {
      requestsThisMonth: totals?.requestsThisMonth ?? 0,
      tokensThisMonth: Number(totals?.tokensThisMonth ?? 0),
      estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
      recentCalls: recentRows.map((r) => ({
        model: r.model,
        tokens: r.totalTokens ?? 0,
        featureName: r.featureName ?? "unknown",
        userId: r.userId ?? null,
        timestamp: r.createdAt.toISOString(),
      })),
    };
  }),

  getAuditLog: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const events = await ctx.db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          resourceType: auditLog.resourceType,
          resourceId: auditLog.resourceId,
          metadata: auditLog.metadata,
          createdAt: auditLog.createdAt,
          userId: auditLog.userId,
          userEmail: users.email,
          userName: users.name,
        })
        .from(auditLog)
        .leftJoin(users, eq(auditLog.userId, users.id))
        .where(eq(auditLog.tenantId, ctx.tenantId))
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit);

      return {
        events: events.map((e) => ({
          id: e.id,
          type: e.action,
          resourceType: e.resourceType,
          resourceId: e.resourceId,
          metadata: e.metadata as Record<string, unknown>,
          userEmail: e.userEmail ?? null,
          userName: e.userName ?? null,
          timestamp: e.createdAt.toISOString(),
        })),
      };
    }),
});
