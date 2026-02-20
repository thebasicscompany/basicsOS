import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { notifications } from "@basicsos/db";

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return ctx.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.userId),
          eq(notifications.tenantId, ctx.tenantId),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(20);
  }),

  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await ctx.db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            inArray(notifications.id, input.ids),
            eq(notifications.userId, ctx.userId),
          ),
        );
      return { success: true };
    }),

  dismiss: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await ctx.db
        .delete(notifications)
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.userId),
          ),
        );
      return { success: true };
    }),
});
