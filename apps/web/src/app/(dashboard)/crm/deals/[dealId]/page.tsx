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
  DollarSign,
  BarChart3,
  Building2,
  Users,
} from "@basicsos/ui";
import { DealActivitiesPanel } from "./DealActivitiesPanel";

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

  const stage = deal?.stage ?? "lead";
  const stageVariant = STAGE_VARIANT[stage] ?? "secondary";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={deal?.title ?? "Deal"}
        backHref="/crm"
        backLabel="CRM"
        className="mb-0"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Deal details */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  Deal Details
                </CardTitle>
                <Badge variant={stageVariant} className="text-[10px]">
                  {stage}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-800">
                  <DollarSign className="size-4 text-stone-500 dark:text-stone-400" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    Value
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                    ${Number(deal?.value ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-800">
                  <BarChart3 className="size-4 text-stone-500 dark:text-stone-400" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    Probability
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                    {deal?.probability ?? 0}%
                  </p>
                </div>
              </div>

              {deal?.companyId && (
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-800">
                    <Building2 className="size-4 text-stone-500 dark:text-stone-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
                      Company
                    </p>
                    <p className="font-mono text-xs text-stone-700 dark:text-stone-300">
                      {deal.companyId}
                    </p>
                  </div>
                </div>
              )}

              {deal?.contactId && (
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-800">
                    <Users className="size-4 text-stone-500 dark:text-stone-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
                      Contact
                    </p>
                    <p className="font-mono text-xs text-stone-700 dark:text-stone-300">
                      {deal.contactId}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-1 border-t border-stone-100 pt-3 dark:border-stone-800">
                <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  Created
                </p>
                <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">
                  {deal?.createdAt
                    ? new Date(deal.createdAt as string | Date).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activities panel */}
        <div className="lg:col-span-2">
          <DealActivitiesPanel dealId={dealId} />
        </div>
      </div>
    </div>
  );
};

export default DealDetailPage;
