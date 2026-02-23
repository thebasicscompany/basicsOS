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
import { CrmHistoryPanel } from "../../components/CrmHistoryPanel";

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
  const { data: deal, isLoading, error } = trpc.crm.deals.get.useQuery({ id: dealId });

  if (isLoading) {
    return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  }

  if (error ?? !deal) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={deal?.title ?? "Deal"}
        backHref="/crm"
        backLabel="Pipeline"
        className="mb-6"
      />

      <Card>
        <CardHeader>
          <CardTitle>Deal Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-stone-500">Stage</dt>
              <dd className="mt-1">
                {deal?.stage != null && (
                  <Badge variant={STAGE_VARIANT[deal.stage] ?? "secondary"}>
                    {deal.stage}
                  </Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Value</dt>
              <dd className="mt-1 text-stone-900 tabular-nums">
                ${Number(deal?.value ?? 0).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Probability</dt>
              <dd className="mt-1 text-stone-900">{deal?.probability ?? 0}%</dd>
            </div>
            {deal?.companyId != null && (
              <div>
                <dt className="font-medium text-stone-500">Company ID</dt>
                <dd className="mt-1 text-stone-900 font-mono text-xs">{deal.companyId}</dd>
              </div>
            )}
            {deal?.contactId != null && (
              <div>
                <dt className="font-medium text-stone-500">Contact ID</dt>
                <dd className="mt-1 text-stone-900 font-mono text-xs">{deal.contactId}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {deal?.activities != null && deal.activities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
              {deal.activities.map((activity) => (
                <li key={activity.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-[10px]">{activity.type}</Badge>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stone-900 dark:text-stone-100">
                    {activity.content}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <CrmHistoryPanel entity="deal" recordId={dealId} />
    </div>
  );
};

export default DealDetailPage;
