import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import type { TRPCContext } from "./context.js";
import { isAdmin, isMember } from "@basicsos/auth";

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
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
 */
export const memberProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
  }
  if (!isMember(ctx.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Member role required" });
  }
  return next({
    ctx: {
      ...ctx,
      tenantId: ctx.tenantId,
    },
  });
});

/**
 * Admin procedure — requires Admin role and a tenantId.
 * Throws 401 if no tenantId, 403 FORBIDDEN for Member and Viewer users.
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
  }
  if (!isAdmin(ctx.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  }
  return next({
    ctx: {
      ...ctx,
      tenantId: ctx.tenantId,
    },
  });
});
