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
  Avatar,
  AvatarFallback,
} from "@basicsos/ui";
import { CrmHistoryPanel } from "../../components/CrmHistoryPanel";

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title={company?.name ?? "Company"}
        backHref="/crm"
        backLabel="CRM"
        className="mb-6"
      />

      <Card>
        <CardHeader>
          <CardTitle>Company Info</CardTitle>
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
          </dl>
        </CardContent>
      </Card>

      {company?.contacts != null && company.contacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
              {company.contacts.map((contact) => (
                <li key={contact.id} className="flex items-center gap-3 py-3">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      {contact.name[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                      {contact.name}
                    </p>
                    <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                      {contact.email ?? "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <CrmHistoryPanel entity="company" recordId={companyId} />
    </div>
  );
};

export default CompanyDetailPage;
