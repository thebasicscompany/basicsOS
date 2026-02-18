import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, asc } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { hubLinks, integrations } from "@basicsos/db";

const AVAILABLE_SERVICES = [
  { service: "slack", label: "Slack" },
  { service: "google-drive", label: "Google Drive" },
  { service: "github", label: "GitHub" },
] as const;

export const hubRouter = router({
  // Hub Links
  listLinks: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return ctx.db.select().from(hubLinks)
      .where(eq(hubLinks.tenantId, ctx.tenantId))
      .orderBy(asc(hubLinks.position));
  }),

  createLink: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      url: z.string().url(),
      icon: z.string().optional(),
      category: z.string().default("custom"),
      position: z.number().int().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const [link] = await ctx.db.insert(hubLinks)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      if (!link) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return link;
    }),

  updateLink: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(255).optional(),
      url: z.string().url().optional(),
      icon: z.string().optional(),
      category: z.string().optional(),
      position: z.number().int().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      const [updated] = await ctx.db.update(hubLinks)
        .set(updateData)
        .where(and(eq(hubLinks.id, id), eq(hubLinks.tenantId, ctx.tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  deleteLink: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db.delete(hubLinks)
        .where(and(eq(hubLinks.id, input.id), eq(hubLinks.tenantId, ctx.tenantId)))
        .returning();
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  reorderLinks: adminProcedure
    .input(z.object({
      updates: z.array(z.object({
        id: z.string().uuid(),
        position: z.number().int().min(0),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.updates.map((u) =>
          ctx.db.update(hubLinks).set({ position: u.position })
            .where(and(eq(hubLinks.id, u.id), eq(hubLinks.tenantId, ctx.tenantId))),
        ),
      );
      return { updated: input.updates.length };
    }),

  // Integrations
  listIntegrations: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    const connected = await ctx.db.select().from(integrations)
      .where(eq(integrations.tenantId, ctx.tenantId));
    const connectedServices = new Set(connected.map((i) => i.service));
    return AVAILABLE_SERVICES.map((svc) => ({
      ...svc,
      connected: connectedServices.has(svc.service),
    }));
  }),

  connectIntegration: adminProcedure
    .input(z.object({
      service: z.string(),
      oauthCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.select().from(integrations)
        .where(and(
          eq(integrations.tenantId, ctx.tenantId),
          eq(integrations.service, input.service),
        ));

      if (existing.length > 0) {
        const [updated] = await ctx.db.update(integrations)
          .set({ connectedAt: new Date() })
          .where(and(
            eq(integrations.tenantId, ctx.tenantId),
            eq(integrations.service, input.service),
          ))
          .returning();
        return updated;
      }

      const [integration] = await ctx.db.insert(integrations)
        .values({
          tenantId: ctx.tenantId,
          service: input.service,
          oauthTokenEnc: "placeholder-encrypted-token",
          connectedAt: new Date(),
        })
        .returning();
      return integration;
    }),

  disconnectIntegration: adminProcedure
    .input(z.object({ service: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(integrations)
        .where(and(
          eq(integrations.tenantId, ctx.tenantId),
          eq(integrations.service, input.service),
        ));
      return { success: true };
    }),
});
