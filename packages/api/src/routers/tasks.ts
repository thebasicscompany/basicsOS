import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, lt, ne, isNotNull, desc } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure } from "../trpc.js";
import { tasks } from "@basicsos/db";
import { insertTaskSchema, updateTaskSchema } from "@basicsos/shared";
import { EventBus, createEvent } from "../events/bus.js";

const listInputSchema = z.object({
  status: z.enum(["todo", "in-progress", "done"]).optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  sourceType: z.enum(["meeting", "automation", "ai-employee"]).optional(),
  limit: z.number().int().min(1).max(1000).default(500),
});

export const tasksRouter = router({
  list: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    const conditions = [eq(tasks.tenantId, ctx.tenantId ?? "")];

    if (input.status !== undefined) {
      conditions.push(eq(tasks.status, input.status));
    }
    if (input.assigneeId !== undefined) {
      conditions.push(eq(tasks.assigneeId, input.assigneeId));
    }
    if (input.priority !== undefined) {
      conditions.push(eq(tasks.priority, input.priority));
    }
    if (input.sourceType !== undefined) {
      conditions.push(eq(tasks.sourceType, input.sourceType));
    }

    return ctx.db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(tasks.createdAt)
      .limit(input.limit);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, input.id), eq(tasks.tenantId, ctx.tenantId ?? "")));

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      return task;
    }),

  create: memberProcedure
    .input(insertTaskSchema.omit({ tenantId: true, createdBy: true }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .insert(tasks)
        .values({
          ...input,
          tenantId: ctx.tenantId,
          createdBy: ctx.userId,
        })
        .returning();

      if (!task) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      EventBus.emit(
        createEvent({
          type: "task.created",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { taskId: task.id },
        }),
      );

      return task;
    }),

  update: memberProcedure
    .input(updateTaskSchema.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const [existing] = await ctx.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.tenantId, ctx.tenantId)));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const [updated] = await ctx.db
        .update(tasks)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(tasks.id, id), eq(tasks.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      if (updateData.status === "done" && existing.status !== "done") {
        EventBus.emit(
          createEvent({
            type: "task.completed",
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            payload: { taskId: updated.id },
          }),
        );
      }

      if (updateData.assigneeId !== undefined && updateData.assigneeId !== existing.assigneeId) {
        EventBus.emit(
          createEvent({
            type: "task.assigned",
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            payload: { taskId: updated.id, assigneeId: updateData.assigneeId },
          }),
        );
      }

      return updated;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(tasks)
        .where(and(eq(tasks.id, input.id), eq(tasks.tenantId, ctx.tenantId)))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      return { success: true };
    }),

  listByEntity: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(["contact", "company", "deal"]),
        entityId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return ctx.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.tenantId, ctx.tenantId),
            eq(tasks.relatedEntityType, input.entityType),
            eq(tasks.relatedEntityId, input.entityId),
          ),
        )
        .orderBy(desc(tasks.createdAt));
    }),

  getOverdue: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, ctx.tenantId ?? ""),
          lt(tasks.dueDate, new Date()),
          ne(tasks.status, "done"),
          isNotNull(tasks.dueDate),
        ),
      );
  }),
});
