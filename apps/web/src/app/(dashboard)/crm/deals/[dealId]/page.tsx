"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { notFound } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PageHeader,
  Badge,
} from "@basicsos/ui";
import { CrmAttachmentsPanel } from "../../components/CrmAttachmentsPanel";

interface DealDetailPageProps {
  params: Promise<{ dealId: string }>;
}

const STAGE_VARIANT: Record<
  string,
  "secondary" | "default" | "warning" | "destructive" | "success" | "outline"
> = {
  lead: "secondary",
  qualified: "default",
  proposal: "warning",
  negotiation: "warning",
  won: "success",
  lost: "destructive",
};

// Next.js App Router requires default export — framework exception.
const DealDetailPage = ({ params }: DealDetailPageProps): JSX.Element => {
  const { dealId } = use(params);
  const { data, isLoading, error } = trpc.crm.deals.get.useQuery({ id: dealId });

  if (isLoading) {
    return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  }

  if (error ?? !data) {
    notFound();
  }

  const deal = data;

  return (
    <div>
      <PageHeader
        title={deal?.title ?? "Deal"}
        backHref="/crm"
        backLabel="Pipeline"
        className="mb-6"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Deal Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-stone-500">Stage</dt>
                <dd className="mt-1">
                  <Badge variant={STAGE_VARIANT[deal?.stage ?? "lead"] ?? "secondary"}>
                    {deal?.stage ?? "—"}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-500">Value</dt>
                <dd className="mt-1 text-stone-900">
                  {deal?.value != null ? `$${Number(deal.value).toLocaleString()}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-500">Probability</dt>
                <dd className="mt-1 text-stone-900">{deal?.probability ?? 0}%</dd>
              </div>
              {deal?.closeDate != null && (
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

        <CrmAttachmentsPanel entity="deal" recordId={dealId} />
      </div>
    </div>
  );
};

export default DealDetailPage;
