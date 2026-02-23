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
import { CrmAttachmentsPanel } from "../../components/CrmAttachmentsPanel";

interface CompanyDetailPageProps {
  params: Promise<{ companyId: string }>;
}

// Next.js App Router requires default export — framework exception.
const CompanyDetailPage = ({ params }: CompanyDetailPageProps): JSX.Element => {
  const { companyId } = use(params);
  const { data, isLoading, error } = trpc.crm.companies.get.useQuery({ id: companyId });

  if (isLoading) {
    return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  }

  if (error ?? !data) {
    notFound();
  }

  // data is guaranteed non-null here — notFound() throws above
  const { contacts: companyContacts, ...company } = data!;

  return (
    <div>
      <PageHeader
        title={company?.name ?? "Company"}
        backHref="/crm"
        backLabel="CRM"
        className="mb-6"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
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

          {companyContacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Contacts ({companyContacts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {companyContacts.map((c) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="bg-stone-100 text-xs font-medium text-stone-600">
                          {c.name[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-900">{c.name}</p>
                        <p className="truncate text-xs text-stone-500">{c.email ?? "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <CrmAttachmentsPanel entity="company" recordId={companyId} />
      </div>
    </div>
  );
};

export default CompanyDetailPage;
