import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure, adminProcedure } from "../trpc.js";
import { aiEmployeeJobs, aiEmployeeOutputs } from "@basicsos/db";
import { EventBus, createEvent } from "../events/bus.js";

export const aiEmployeesRouter = router({
  listJobs: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return ctx.db.select().from(aiEmployeeJobs).where(eq(aiEmployeeJobs.tenantId, ctx.tenantId));
  }),

  getJob: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const [job] = await ctx.db
        .select()
        .from(aiEmployeeJobs)
        .where(and(eq(aiEmployeeJobs.id, input.id), eq(aiEmployeeJobs.tenantId, ctx.tenantId)));
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      const outputs = await ctx.db
        .select()
        .from(aiEmployeeOutputs)
        .where(eq(aiEmployeeOutputs.jobId, job.id));
      return { ...job, outputs };
    }),

  createJob: memberProcedure
    .input(
      z.object({
        title: z.string().min(1).max(512),
        instructions: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [job] = await ctx.db
        .insert(aiEmployeeJobs)
        .values({
          tenantId: ctx.tenantId,
          title: input.title,
          instructions: input.instructions,
          status: "pending",
          createdBy: ctx.userId,
        })
        .returning();
      if (!job) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      EventBus.emit(
        createEvent({
          type: "ai_employee.started",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { jobId: job.id },
        }),
      );

      return job;
    }),

  kill: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(aiEmployeeJobs)
        .set({ status: "killed" })
        .where(and(eq(aiEmployeeJobs.id, input.id), eq(aiEmployeeJobs.tenantId, ctx.tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      EventBus.emit(
        createEvent({
          type: "ai_employee.killed",
          tenantId: ctx.tenantId,
          payload: { jobId: input.id },
        }),
      );

      return updated;
    }),

  approveOutput: memberProcedure
    .input(z.object({ outputId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [output] = await ctx.db
        .select()
        .from(aiEmployeeOutputs)
        .where(eq(aiEmployeeOutputs.id, input.outputId));
      if (!output) throw new TRPCError({ code: "NOT_FOUND" });

      const [job] = await ctx.db
        .select()
        .from(aiEmployeeJobs)
        .where(and(eq(aiEmployeeJobs.id, output.jobId), eq(aiEmployeeJobs.tenantId, ctx.tenantId)));
      if (!job) throw new TRPCError({ code: "FORBIDDEN" });

      const [approved] = await ctx.db
        .update(aiEmployeeOutputs)
        .set({ requiresApproval: false, approvedAt: new Date(), approvedBy: ctx.userId })
        .where(eq(aiEmployeeOutputs.id, input.outputId))
        .returning();
      return approved;
    }),

  listOutputs: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const [job] = await ctx.db
        .select({ id: aiEmployeeJobs.id })
        .from(aiEmployeeJobs)
        .where(and(eq(aiEmployeeJobs.id, input.jobId), eq(aiEmployeeJobs.tenantId, ctx.tenantId)));
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db
        .select()
        .from(aiEmployeeOutputs)
        .where(eq(aiEmployeeOutputs.jobId, input.jobId));
    }),
});
