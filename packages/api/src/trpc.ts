import { initTRPC, TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";
import type { TRPCContext } from "./context.js";
import { isAdmin, isMember } from "@basicsos/auth";
import type { DbConnection } from "@basicsos/db";

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure — requires a valid authenticated session.
 * Throws 401 UNAUTHORIZED if the user is not logged in.
 * Does NOT require a tenantId — allows freshly registered users to query
 * their own session (e.g. `auth.me`) before accepting an invite.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId || !ctx.role) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      role: ctx.role,
      sessionId: ctx.sessionId,
    },
  });
});

/**
 * Member procedure — requires Member or Admin role and a tenantId.
 * Throws 403 FORBIDDEN for Viewer-only users.
 * Wraps execution in a transaction and sets app.tenant_id so RLS policies
 * actually filter rows to the current tenant.
 */
export const memberProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
  }
  if (!isMember(ctx.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Member role required" });
  }

  return ctx.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${ctx.tenantId!}, true)`);
    return next({ ctx: { ...ctx, db: tx as unknown as DbConnection, tenantId: ctx.tenantId! } });
  });
});

/**
 * Admin procedure — requires Admin role and a tenantId.
 * Throws 401 if no tenantId, 403 FORBIDDEN for Member and Viewer users.
 * Wraps execution in a transaction and sets app.tenant_id so RLS policies
 * actually filter rows to the current tenant.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
  }
  if (!isAdmin(ctx.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  }

  return ctx.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${ctx.tenantId!}, true)`);
    return next({ ctx: { ...ctx, db: tx as unknown as DbConnection, tenantId: ctx.tenantId! } });
  });
});
