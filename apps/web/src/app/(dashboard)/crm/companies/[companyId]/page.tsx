"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, PageHeader, Avatar, AvatarFallback } from "@basicsos/ui";
import { CrmTasksPanel } from "../../components/CrmTasksPanel";

interface CompanyDetailPageProps {
  params: Promise<{ companyId: string }>;
}

// Next.js App Router requires default export — framework exception.
const CompanyDetailPage = ({ params }: CompanyDetailPageProps): JSX.Element => {
  const { companyId } = use(params);
  const { data: company, isLoading, error } = trpc.crm.companies.get.useQuery({ id: companyId });

  if (isLoading) {
    return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  }

  if (error ?? !company) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title={company?.name ?? "Company"}
        backHref="/crm"
        backLabel="CRM"
        className="mb-6"
      />

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="text-sm font-semibold bg-stone-100 text-stone-600">
                {company?.name[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <CardTitle>{company?.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-stone-500">Domain</dt>
              <dd className="mt-1 text-stone-900">{company?.domain ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Industry</dt>
              <dd className="mt-1 text-stone-900">{company?.industry ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Contacts</dt>
              <dd className="mt-1 text-stone-900">{company?.contacts?.length ?? 0}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <CrmTasksPanel entityType="company" entityId={companyId} />
    </div>
  );
};

export default CompanyDetailPage;
