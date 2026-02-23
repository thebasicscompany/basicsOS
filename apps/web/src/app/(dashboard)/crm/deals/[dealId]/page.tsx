"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, PageHeader, Badge } from "@basicsos/ui";
import { CrmTasksPanel } from "../../components/CrmTasksPanel";

interface DealDetailPageProps {
  params: Promise<{ dealId: string }>;
}

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-stone-100 text-stone-600",
  qualified: "bg-blue-100 text-blue-700",
  proposal: "bg-amber-100 text-amber-700",
  negotiation: "bg-purple-100 text-purple-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
};

const formatCurrency = (value: string | null | undefined): string => {
  const num = Number(value ?? 0);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}k`;
  return `$${num.toLocaleString()}`;
};

// Next.js App Router requires default export — framework exception.
const DealDetailPage = ({ params }: DealDetailPageProps): JSX.Element => {
  const { dealId } = use(params);
  const { data: deal, isLoading, error } = trpc.crm.deals.get.useQuery({ id: dealId });

  if (isLoading) {
    return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  }

  if (error ?? !deal) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title={deal?.title ?? "Deal"}
        backHref="/crm?view=pipeline"
        backLabel="Pipeline"
        className="mb-6"
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Deal Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-stone-500">Stage</dt>
              <dd className="mt-1">
                <Badge className={`text-xs ${STAGE_COLORS[deal?.stage ?? "lead"] ?? ""}`}>
                  {deal?.stage ?? "—"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Value</dt>
              <dd className="mt-1 text-stone-900">{formatCurrency(deal?.value)}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Probability</dt>
              <dd className="mt-1 text-stone-900">{deal?.probability ?? 0}%</dd>
            </div>
            {deal?.closeDate && (
              <div>
                <dt className="font-medium text-stone-500">Close Date</dt>
                <dd className="mt-1 text-stone-900">
                  {new Date(deal.closeDate).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <CrmTasksPanel entityType="deal" entityId={dealId} />
    </div>
  );
};

export default DealDetailPage;
