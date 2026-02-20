"use client";

// Next.js App Router requires default export — framework exception.

import { trpc } from "@/lib/trpc";
import { Button, Badge, addToast } from "@basicsos/ui";

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$29/mo",
    description: "For small teams. Includes all core modules and AI features.",
  },
  {
    id: "team" as const,
    name: "Team",
    price: "$99/mo",
    description: "Unlimited members, priority support, and SLA guarantee.",
  },
];

const BillingPage = (): JSX.Element => {
  const { data, isLoading } = trpc.billing.getSubscription.useQuery();

  const checkout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) =>
      addToast({ title: "Checkout failed", description: err.message, variant: "destructive" }),
  });

  const portal = trpc.billing.createPortalSession.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) =>
      addToast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const currentPlan = data?.plan ?? "starter";
  const sub = data?.subscription;
  const hasActiveSub = sub?.status === "active";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Billing</h1>
        <p className="mt-1 text-stone-500">Manage your plan and subscription.</p>
      </div>

      {/* Current plan */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500">Current plan</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold capitalize text-stone-900">
                {isLoading ? "…" : currentPlan}
              </span>
              {sub?.status && (
                <Badge variant={sub.status === "active" ? "success" : "secondary"}>
                  {sub.status}
                </Badge>
              )}
            </div>
            {sub?.currentPeriodEnd && (
              <p className="mt-1 text-xs text-stone-400">
                {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"}{" "}
                {new Date(sub.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
          {hasActiveSub && (
            <Button
              variant="outline"
              onClick={() => portal.mutate({ returnUrl: window.location.href })}
              disabled={portal.isPending}
            >
              {portal.isPending ? "Loading…" : "Manage subscription"}
            </Button>
          )}
        </div>
      </div>

      {/* Upgrade options — only shown when not on an active paid plan */}
      {!hasActiveSub && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-stone-700">Upgrade your plan</h2>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between rounded-xl border bg-white p-5"
            >
              <div>
                <p className="font-semibold text-stone-900">
                  {plan.name}{" "}
                  <span className="font-normal text-stone-500">{plan.price}</span>
                </p>
                <p className="mt-0.5 text-sm text-stone-500">{plan.description}</p>
              </div>
              <Button
                variant={plan.id === "team" ? "default" : "outline"}
                onClick={() =>
                  checkout.mutate({
                    plan: plan.id,
                    successUrl: `${window.location.origin}/admin/billing`,
                    cancelUrl: window.location.href,
                  })
                }
                disabled={checkout.isPending}
              >
                {checkout.isPending ? "Loading…" : `Upgrade to ${plan.name}`}
              </Button>
            </div>
          ))}
          <p className="text-xs text-stone-400">Payments handled by Stripe. Cancel anytime.</p>
        </div>
      )}

      {/* Self-hosted note */}
      <div className="rounded-xl border bg-stone-50 p-5">
        <h3 className="font-medium text-stone-700">Self-Hosted</h3>
        <p className="mt-1 text-sm text-stone-500">
          Running this yourself? Billing only applies to managed hosting at basicsos.com. Your
          self-hosted instance is always free.
        </p>
        <a
          href="https://basicsos.com"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          Learn about managed hosting →
        </a>
      </div>
    </div>
  );
};

export default BillingPage;
