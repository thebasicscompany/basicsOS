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
import { Globe, Briefcase, Calendar, Users, Trash } from "@basicsos/ui";
import { CrmSummaryCard } from "../../components/CrmSummaryCard";
import { CrmFieldGrid } from "../../components/CrmFieldGrid";
import { CrmRelatedList } from "../../components/CrmRelatedList";
import { CrmCustomFieldsSection } from "../../components/CrmCustomFieldsSection";
import { CrmActivityTabs } from "../../components/CrmActivityTabs";
import { EditCompanyDialog } from "../../EditCompanyDialog";
import { formatCurrency } from "../../utils";
import { FavoriteButton } from "../../components/FavoriteButton";
import { CompanyDuplicatesPanel } from "../../components/DuplicatesPanel";

interface CompanyDetailPageProps {
  params: Promise<{ companyId: string }>;
}

const CompanyDetailPage = ({ params }: CompanyDetailPageProps): JSX.Element => {
  const { companyId } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: company, isLoading, error } = trpc.crm.companies.get.useQuery({ id: companyId });
  const { data: dealsData } = trpc.crm.deals.listByStage.useQuery();

  if (isLoading) {
    return <CompanyDetailSkeleton />;
  }
  if (error ?? !company) {
    notFound();
  }

  const companyDeals = (dealsData ?? [])
    .flatMap((g) => g.deals)
    .filter((d) => d.companyId === companyId);

  const fields = [
    ...(company.domain ? [{ icon: Globe, label: "Domain", value: company.domain }] : []),
    ...(company.industry ? [{ icon: Briefcase, label: "Industry", value: company.industry }] : []),
    { icon: Users, label: "Contacts", value: String(company.contacts.length) },
    { icon: Calendar, label: "Created", value: new Date(company.createdAt).toLocaleDateString() },
  ];

  const contactRecords = company.contacts.map((c: { id: string; name: string; email: string | null }) => ({
    id: c.id,
    href: `/crm/contacts/${c.id}`,
    cells: [
      { value: c.name },
      { value: c.email ?? "\u2014" },
    ],
  }));

  const dealRecords = companyDeals.map((d) => ({
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
        title={company.name}
        backHref="/crm/companies"
        backLabel="Companies"
        action={
          <div className="flex gap-2">
            <FavoriteButton entity="company" recordId={company.id} />
            <EditCompanyDialog company={company} onUpdated={() => void utils.crm.companies.get.invalidate({ id: companyId })}>
              <Button variant="outline" size="sm">Edit</Button>
            </EditCompanyDialog>
            <DeleteCompanyButton companyId={company.id} router={router} />
          </div>
        }
      />
      <CompanyDuplicatesPanel />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Left: activity tabs */}
        <div className="flex flex-col gap-6">
          <CrmActivityTabs entity="company" recordId={companyId} />
        </div>

        {/* Right: details panel */}
        <div className="flex flex-col gap-4">
          <CrmSummaryCard
            name={company.name}
            subtitle={company.domain ?? company.industry ?? undefined}
          />
          <CrmFieldGrid title="Details" fields={fields} />
          <CrmCustomFieldsSection
            entity="companies"
            customFields={(company.customFields as Record<string, unknown>) ?? {}}
          />
          <CrmRelatedList
            title="Contacts"
            count={company.contacts.length}
            headers={["Name", "Email"]}
            records={contactRecords}
            viewAllHref="/crm/contacts"
            emptyText="No contacts linked"
          />
          <CrmRelatedList
            title="Deals"
            count={companyDeals.length}
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

function CompanyDetailSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-48 animate-pulse rounded-sm bg-stone-200 dark:bg-stone-700" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardContent className="py-6">
            <div className="h-24 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeleteCompanyButton({
  companyId,
  router,
}: {
  companyId: string;
  router: ReturnType<typeof useRouter>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const deleteCompany = trpc.crm.companies.delete.useMutation({
    onSuccess: () => {
      addToast({ title: "Company deleted", variant: "success" });
      router.push("/crm/companies");
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
            <DialogTitle>Delete Company</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteCompany.mutate({ id: companyId })} disabled={deleteCompany.isPending}>
              {deleteCompany.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CompanyDetailPage;
