export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@basicsos/db";
import { subscriptions, tenants } from "@basicsos/db";
import { eq } from "drizzle-orm";

// POST /api/webhooks/stripe
// Receives Stripe webhook events and keeps tenant subscription state in sync.
// Configure Stripe CLI: stripe listen --forward-to localhost:3000/api/webhooks/stripe

type StripeSubscriptionObject = {
  id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { id: string } }> };
  metadata: Record<string, string>;
  customer: string;
};

type StripeCheckoutSession = {
  metadata: Record<string, string>;
  subscription: string | null;
  customer: string;
};

type StripeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

const PLAN_BY_PRICE: Record<string, string> = {
  [process.env["STRIPE_PRICE_STARTER"] ?? "__missing__"]: "starter",
  [process.env["STRIPE_PRICE_TEAM"] ?? "__missing__"]: "team",
};

const getPlanFromPriceId = (priceId: string): string =>
  PLAN_BY_PRICE[priceId] ?? "starter";

const handleSubscriptionUpdated = async (sub: StripeSubscriptionObject): Promise<void> => {
  const tenantId = sub.metadata["tenantId"];
  if (!tenantId) return;

  const priceId = sub.items.data[0]?.price.id ?? "";
  const plan = getPlanFromPriceId(priceId);

  await db
    .insert(subscriptions)
    .values({
      tenantId,
      stripeCustomerId: sub.customer,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan,
      status: sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeCustomerId,
      set: {
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        plan,
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });

  // Mirror the plan onto the tenant row for fast reads
  await db
    .update(tenants)
    .set({ plan })
    .where(eq(tenants.id, tenantId));
};

const handleSubscriptionDeleted = async (sub: StripeSubscriptionObject): Promise<void> => {
  const tenantId = sub.metadata["tenantId"];
  if (!tenantId) return;

  await db
    .update(subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(subscriptions.tenantId, tenantId));

  await db
    .update(tenants)
    .set({ plan: "starter" })
    .where(eq(tenants.id, tenantId));
};

const handleCheckoutCompleted = async (session: StripeCheckoutSession): Promise<void> => {
  // Nothing to do here — subscription.created/updated events handle state sync.
  // This handler exists for future provisioning logic (e.g. send welcome email).
  const tenantId = session.metadata["tenantId"];
  if (tenantId) {
    console.warn(`[stripe-webhook] checkout.session.completed for tenant:${tenantId}`);
  }
};

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    const body = await req.text();
    // Dynamic import to avoid startup errors when Stripe is not installed
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] ?? "", {
      apiVersion: "2025-02-24.acacia",
    });
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret) as unknown as StripeEvent;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as StripeSubscriptionObject);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as StripeSubscriptionObject);
        break;
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as StripeCheckoutSession);
        break;
      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe-webhook] Handler error for ${event.type}:`, message);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
};
