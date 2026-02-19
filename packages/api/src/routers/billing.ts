import Stripe from "stripe";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, protectedProcedure } from "../trpc.js";
import { subscriptions, tenants } from "@basicsos/db";

// Stripe price IDs — configured via environment variables so they work across
// test and live modes without code changes.
const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env["STRIPE_PRICE_STARTER"] ?? "",
  team: process.env["STRIPE_PRICE_TEAM"] ?? "",
};

const getStripe = (): Stripe => {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe is not configured — set STRIPE_SECRET_KEY in .env",
    });
  }
  return new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });
};

export const billingRouter = router({
  /** Returns the current subscription state for the tenant. */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const [sub] = await ctx.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, ctx.tenantId));

    const [tenant] = await ctx.db
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId));

    return {
      plan: tenant?.plan ?? "starter",
      subscription: sub ?? null,
    };
  }),

  /**
   * Creates a Stripe Checkout session for plan upgrade.
   * Returns the session URL for redirect.
   */
  createCheckoutSession: adminProcedure
    .input(z.object({
      plan: z.enum(["starter", "team"]),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const priceId = PLAN_PRICE_IDS[input.plan];
      if (!priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No price configured for plan "${input.plan}". Set STRIPE_PRICE_${input.plan.toUpperCase()} in .env`,
        });
      }

      // Find or create Stripe customer for this tenant
      const [existing] = await ctx.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, ctx.tenantId));

      let customerId: string;

      if (existing?.stripeCustomerId) {
        customerId = existing.stripeCustomerId;
      } else {
        const [tenant] = await ctx.db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, ctx.tenantId));

        const customerParams: { metadata: Record<string, string>; name?: string } = {
          metadata: { tenantId: ctx.tenantId },
        };
        if (tenant?.name) customerParams.name = tenant.name;
        const customer = await stripe.customers.create(customerParams);
        customerId = customer.id;

        // Persist the customer id so future calls reuse it
        await ctx.db
          .insert(subscriptions)
          .values({
            tenantId: ctx.tenantId,
            stripeCustomerId: customerId,
            plan: "starter",
            status: "incomplete",
          })
          .onConflictDoNothing();
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { tenantId: ctx.tenantId },
        subscription_data: {
          metadata: { tenantId: ctx.tenantId },
        },
      });

      if (!session.url) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe did not return a session URL" });
      }

      return { url: session.url, sessionId: session.id };
    }),

  /**
   * Creates a Stripe Customer Portal session for plan management / cancellation.
   */
  createPortalSession: adminProcedure
    .input(z.object({ returnUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();

      const [sub] = await ctx.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, ctx.tenantId));

      if (!sub?.stripeCustomerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Stripe customer found — subscribe to a plan first",
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: input.returnUrl,
      });

      return { url: session.url };
    }),
});
