import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../trpc.js";
import { invites } from "@basicsos/db";
import { insertInviteSchema } from "@basicsos/shared";
import { sendInviteEmail } from "../lib/email.js";

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    tenantId: ctx.tenantId ?? null,
    role: ctx.role,
  })),

  sendInvite: adminProcedure
    .input(insertInviteSchema.pick({ email: true, role: true }))
    .mutation(async ({ ctx, input }) => {
      // Guard against duplicate pending invites for same email + tenant
      const [existing] = await ctx.db
        .select({ id: invites.id })
        .from(invites)
        .where(
          and(
            eq(invites.tenantId, ctx.tenantId),
            eq(invites.email, input.email),
            isNull(invites.acceptedAt),
          ),
        );
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A pending invite already exists for this email" });
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [invite] = await ctx.db
        .insert(invites)
        .values({
          tenantId: ctx.tenantId,
          email: input.email,
          role: input.role ?? "member",
          token,
          expiresAt,
        })
        .returning();
      if (!invite) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
      const inviteUrl = `${appUrl}/auth/invite/${token}`;

      await sendInviteEmail({
        to: input.email,
        inviterName: ctx.userId ? "A team member" : "Admin", // TODO: look up inviter name
        companyName: process.env["BASICOS_COMPANY_NAME"] ?? "Your company",
        role: input.role ?? "member",
        inviteUrl,
      }).catch((err: unknown) => {
        // Don't fail the mutation if email fails — log and continue
        console.error("[sendInvite] Email delivery failed:", err);
      });

      return { inviteId: invite.id };
    }),

  validateInvite: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const [invite] = await ctx.db
        .select()
        .from(invites)
        .where(eq(invites.token, input.token));
      if (!invite) throw new TRPCError({ code: "NOT_FOUND" });
      if (invite.acceptedAt) throw new TRPCError({ code: "CONFLICT", message: "Invite already used" });
      if (invite.expiresAt < new Date()) throw new TRPCError({ code: "FORBIDDEN", message: "Invite expired" });
      return { email: invite.email, role: invite.role, tenantId: invite.tenantId };
    }),
});
