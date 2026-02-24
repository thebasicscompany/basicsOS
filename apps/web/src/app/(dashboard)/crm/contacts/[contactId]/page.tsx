"use client";

import { use, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  PageHeader,
  Card,
  CardContent,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  addToast,
} from "@basicsos/ui";
import { Envelope, Phone, Buildings, Trash, Calendar } from "@basicsos/ui";
import { CrmSummaryCard } from "../../components/CrmSummaryCard";
import { CrmFieldGrid } from "../../components/CrmFieldGrid";
import { CrmRelatedList } from "../../components/CrmRelatedList";
import { CrmCustomFieldsSection } from "../../components/CrmCustomFieldsSection";
import { CrmActivityTabs } from "../../components/CrmActivityTabs";
import { EditContactDialog } from "../../EditContactDialog";
import { formatCurrency } from "../../utils";
import { FavoriteButton } from "../../components/FavoriteButton";
import { EnrichmentSuggestionBanner } from "../../components/EnrichmentSuggestionBanner";

interface ContactDetailPageProps {
  params: Promise<{ contactId: string }>;
}

const ContactDetailPage = ({ params }: ContactDetailPageProps): JSX.Element => {
  const { contactId } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: contact, isLoading, error } = trpc.crm.contacts.get.useQuery({ id: contactId });
  const { data: dealsData } = trpc.crm.deals.listByStage.useQuery();
  const { data: company } = trpc.crm.companies.get.useQuery(
    { id: contact?.companyId ?? "" },
    { enabled: !!contact?.companyId },
  );

  if (isLoading) {
    return <ContactDetailSkeleton />;
  }
  if (error ?? !contact) {
    notFound();
  }

  const contactDeals = (dealsData ?? [])
    .flatMap((g) => g.deals)
    .filter((d) => d.contactId === contactId);

  const invalidate = (): void => {
    void utils.crm.contacts.get.invalidate({ id: contactId });
  };

  const fields = [
    { icon: Envelope, label: "Email", value: contact.email ?? "\u2014" },
    { icon: Phone, label: "Phone", value: contact.phone ?? "\u2014" },
    ...(company
      ? [{ icon: Buildings, label: "Company", value: company.name, href: `/crm/companies/${company.id}` }]
      : []),
    { icon: Calendar, label: "Created", value: new Date(contact.createdAt).toLocaleDateString() },
  ];

  const dealRecords = contactDeals.map((d) => ({
    id: d.id,
    href: `/crm/deals/${d.id}`,
    cells: [
      { value: d.title },
      { value: <Badge variant="outline" className="capitalize text-xs">{d.stage}</Badge> },
      { value: formatCurrency(Number(d.value ?? 0)), align: "right" as const },
    ],
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={contact.name}
        backHref="/crm/contacts"
        backLabel="People"
        action={
          <div className="flex gap-2">
            <FavoriteButton entity="contact" recordId={contact.id} />
            <EditContactDialog contact={contact} onUpdated={invalidate}>
              <Button variant="outline" size="sm">Edit</Button>
            </EditContactDialog>
            <DeleteContactButton contactId={contact.id} router={router} />
          </div>
        }
      />
      <EnrichmentSuggestionBanner contactId={contactId} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Left: activity tabs */}
        <div className="flex flex-col gap-6">
          <CrmActivityTabs entity="contact" recordId={contactId} />
        </div>

        {/* Right: details panel */}
        <div className="flex flex-col gap-4">
          <CrmSummaryCard
            name={contact.name}
            subtitle={contact.email ?? undefined}
            showEmailAction={!!contact.email}
            showCallAction={!!contact.phone}
            email={contact.email}
            phone={contact.phone}
          />
          <CrmFieldGrid title="Details" fields={fields} />
          <CrmCustomFieldsSection
            entity="contacts"
            customFields={(contact.customFields as Record<string, unknown>) ?? {}}
          />
          <CrmRelatedList
            title="Deals"
            count={contactDeals.length}
            headers={["Deal", "Stage", "Value"]}
            records={dealRecords}
            viewAllHref="/crm/deals"
            emptyText="No deals associated"
          />
        </div>
      </div>
    </div>
  );
};

function ContactDetailSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-48 animate-pulse rounded-sm bg-stone-200 dark:bg-stone-700" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardContent className="py-8">
            <div className="h-24 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="size-16 animate-pulse rounded-full bg-stone-200 dark:bg-stone-700" />
              <div className="h-5 w-32 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeleteContactButton({
  contactId,
  router,
}: {
  contactId: string;
  router: ReturnType<typeof useRouter>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const deleteContact = trpc.crm.contacts.delete.useMutation({
    onSuccess: () => {
      addToast({ title: "Contact deleted", variant: "success" });
      router.push("/crm/contacts");
    },
    onError: (err) => {
      addToast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash size={14} className="mr-1" /> Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteContact.mutate({ id: contactId })} disabled={deleteContact.isPending}>
              {deleteContact.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ContactDetailPage;
