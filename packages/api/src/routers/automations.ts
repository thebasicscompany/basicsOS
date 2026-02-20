import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure } from "../trpc.js";
import { automations, automationRuns } from "@basicsos/db";
import { insertAutomationSchema } from "@basicsos/shared";

export const automationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return ctx.db.select().from(automations).where(eq(automations.tenantId, ctx.tenantId));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const [automation] = await ctx.db
        .select()
        .from(automations)
        .where(and(eq(automations.id, input.id), eq(automations.tenantId, ctx.tenantId)));
      if (!automation) throw new TRPCError({ code: "NOT_FOUND" });
      return automation;
    }),

  create: memberProcedure
    .input(insertAutomationSchema.omit({ tenantId: true }))
    .mutation(async ({ ctx, input }) => {
      const [automation] = await ctx.db
        .insert(automations)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      if (!automation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return automation;
    }),

  update: memberProcedure
    .input(insertAutomationSchema.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      const [updated] = await ctx.db
        .update(automations)
        .set(updateData)
        .where(and(eq(automations.id, id), eq(automations.tenantId, ctx.tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  setEnabled: memberProcedure
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(automations)
        .set({ enabled: input.enabled })
        .where(and(eq(automations.id, input.id), eq(automations.tenantId, ctx.tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(automations)
        .where(and(eq(automations.id, input.id), eq(automations.tenantId, ctx.tenantId)))
        .returning();
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  listRuns: protectedProcedure
    .input(z.object({ automationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      // Verify the automation belongs to this tenant before returning runs
      const [automation] = await ctx.db
        .select({ id: automations.id })
        .from(automations)
        .where(and(eq(automations.id, input.automationId), eq(automations.tenantId, ctx.tenantId)));
      if (!automation) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.automationId, input.automationId));
    }),
});
