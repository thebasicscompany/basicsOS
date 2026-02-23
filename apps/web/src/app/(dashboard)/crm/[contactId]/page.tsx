"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, PageHeader } from "@basicsos/ui";
import { CrmAttachmentsPanel } from "../components/CrmAttachmentsPanel";

interface ContactDetailPageProps {
  params: Promise<{ contactId: string }>;
}

// Next.js App Router requires default export — framework exception.
const ContactDetailPage = ({ params }: ContactDetailPageProps): JSX.Element => {
  const { contactId } = use(params);
  const { data: contact, isLoading, error } = trpc.crm.contacts.get.useQuery({ id: contactId });

  if (isLoading) {
    return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  }

  if (error ?? !contact) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title={contact?.name ?? "Contact"}
        backHref="/crm?view=contacts"
        backLabel="Contacts"
        className="mb-6"
      />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Contact Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-stone-500">Email</dt>
              <dd className="mt-1 text-stone-900">{contact?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Phone</dt>
              <dd className="mt-1 text-stone-900">{contact?.phone ?? "—"}</dd>
            </div>
            {contact?.companyId !== null && contact?.companyId !== undefined && (
              <div>
                <dt className="font-medium text-stone-500">Company ID</dt>
                <dd className="mt-1 text-stone-900 font-mono text-xs">{contact.companyId}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <CrmAttachmentsPanel entity="contact" recordId={contactId} />
    </div>
  );
};

export default ContactDetailPage;
