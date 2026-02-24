"use client";

import { Suspense, useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  PageHeader,
  Button,
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  addToast,
} from "@basicsos/ui";
import { Plus, Building2, Globe, Briefcase, Users, Calendar, Download, Pencil } from "@basicsos/ui";
import { CrmRecordTable } from "../components/CrmRecordTable";
import type { ColumnDef } from "../components/CrmRecordTable";
import { CrmViewBar } from "../components/CrmViewBar";
import { CrmBulkActionBar } from "../components/CrmBulkActionBar";
import { BulkEditDialog } from "../components/BulkEditDialog";
import { useCrmViewState, applyCrmFilters } from "../hooks/useCrmViewState";
import type { CrmFilter } from "../hooks/useCrmViewState";
import { useCustomFieldColumns } from "../hooks/useCustomFieldColumns";
import { CreateCompanyDialog } from "../CreateCompanyDialog";
import { nameToColor, exportCsv } from "../utils";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  createdAt: Date | string;
  customFields?: Record<string, unknown> | null;
}

const CompaniesPageContent = (): JSX.Element => {
  const router = useRouter();
  const utils = trpc.useUtils();
  const viewState = useCrmViewState();
  const { data: companiesData, isLoading } = trpc.crm.companies.list.useQuery();
  const { data: contactsData } = trpc.crm.contacts.list.useQuery({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const deleteCompany = trpc.crm.companies.delete.useMutation({
    onSuccess: () => {
      void utils.crm.companies.list.invalidate();
      addToast({ title: "Deleted", variant: "success" });
    },
  });

  const updateCompany = trpc.crm.companies.update.useMutation({
    onSuccess: () => void utils.crm.companies.list.invalidate(),
    onError: (err) => addToast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const companies = useMemo((): Company[] => (companiesData ?? []) as Company[], [companiesData]);

  const contactCountMap = useMemo(() => {
    const map = new Map<string, number>();
    (contactsData ?? []).forEach((c) => {
      if (c.companyId) {
        map.set(c.companyId, (map.get(c.companyId) ?? 0) + 1);
      }
    });
    return map;
  }, [contactsData]);

  const filtered = useMemo(
    () =>
      applyCrmFilters(
        companies,
        viewState,
        ["name", "domain", "industry"],
        (row: Company, field: string) => {
          if (field === "name") return row.name.toLowerCase();
          if (field === "domain") return (row.domain ?? "").toLowerCase();
          if (field === "industry") return (row.industry ?? "").toLowerCase();
          if (field === "contacts") return contactCountMap.get(row.id) ?? 0;
          if (field === "createdAt") return new Date(row.createdAt).getTime();
          if (field.startsWith("cf_")) {
            const key = field.slice(3);
            return String(row.customFields?.[key] ?? "").toLowerCase();
          }
          return "";
        },
      ),
    [companies, viewState, contactCountMap],
  );

  const handleEdit = useCallback(
    (id: string, field: string, value: string) => {
      if (field === "name") updateCompany.mutate({ id, name: value });
      else if (field === "domain") updateCompany.mutate({ id, domain: value || undefined });
      else if (field === "industry") updateCompany.mutate({ id, industry: value || undefined });
    },
    [updateCompany],
  );

  const columns: ColumnDef<Company>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Name",
        icon: Building2,
        sortable: true,
        sortValue: (r: Company) => r.name.toLowerCase(),
        render: (r: Company) => (
          <div className="flex items-center gap-2">
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className={`text-[10px] font-medium ${nameToColor(r.name)}`}>
                {r.name[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground">{r.name}</span>
          </div>
        ),
        editable: true,
        editType: "text",
        onEdit: (id: string, value: string) => handleEdit(id, "name", value),
      },
      {
        key: "domain",
        label: "Domain",
        icon: Globe,
        sortable: true,
        sortValue: (r: Company) => (r.domain ?? "").toLowerCase(),
        render: (r: Company) =>
          r.domain ? (
            <span className="text-sm text-foreground">{r.domain}</span>
          ) : (
            <span className="text-muted-foreground">{"\u2014"}</span>
          ),
        editValue: (r: Company) => r.domain ?? "",
        editable: true,
        editType: "text",
        onEdit: (id: string, value: string) => handleEdit(id, "domain", value),
      },
      {
        key: "industry",
        label: "Industry",
        icon: Briefcase,
        sortable: true,
        sortValue: (r: Company) => (r.industry ?? "").toLowerCase(),
        render: (r: Company) =>
          r.industry ? (
            <Badge variant="secondary">{r.industry}</Badge>
          ) : (
            <span className="text-muted-foreground">{"\u2014"}</span>
          ),
        editable: true,
        editType: "text",
        onEdit: (id: string, value: string) => handleEdit(id, "industry", value),
      },
      {
        key: "contacts",
        label: "Contacts",
        icon: Users,
        sortable: true,
        sortValue: (r: Company) => contactCountMap.get(r.id) ?? 0,
        render: (r: Company) => {
          const count = contactCountMap.get(r.id) ?? 0;
          return count > 0 ? (
            <Badge variant="secondary" className="text-xs">{count}</Badge>
          ) : (
            <span className="text-muted-foreground text-xs">0</span>
          );
        },
      },
      {
        key: "createdAt",
        label: "Created",
        icon: Calendar,
        sortable: true,
        sortValue: (r: Company) => new Date(r.createdAt).getTime(),
        render: (r: Company) => (
          <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
        ),
      },
    ],
    [contactCountMap, handleEdit],
  );

  const handleCustomFieldEdit = useCallback(
    (id: string, key: string, value: unknown) => {
      const company = companies.find((c) => c.id === id);
      const merged = { ...(company?.customFields ?? {}), [key]: value };
      updateCompany.mutate({ id, customFields: merged });
    },
    [companies, updateCompany],
  );

  const customFieldColumns = useCustomFieldColumns<Company>("companies", handleCustomFieldEdit);
  const allColumns = useMemo(
    () => [...columns, ...customFieldColumns],
    [columns, customFieldColumns],
  );

  const handleBulkDelete = useCallback(() => {
    Promise.all(selectedIds.map((id) => deleteCompany.mutateAsync({ id }))).then(() => {
      setSelectedIds([]);
    }).catch(() => {
      addToast({ title: "Some deletions failed", variant: "destructive" });
    });
  }, [selectedIds, deleteCompany]);

  const handleExport = useCallback(() => {
    const selected = filtered.filter((c) => selectedIds.includes(c.id));
    exportCsv(
      selected,
      [
        { key: "name", label: "Name", value: (r) => r.name },
        { key: "domain", label: "Domain", value: (r) => r.domain ?? "" },
        { key: "industry", label: "Industry", value: (r) => r.industry ?? "" },
        { key: "contacts", label: "Contacts", value: (r) => String(contactCountMap.get(r.id) ?? 0) },
        { key: "createdAt", label: "Created", value: (r) => new Date(r.createdAt).toLocaleDateString() },
      ],
      "companies-export",
    );
  }, [filtered, selectedIds, contactCountMap]);

  const handleApplyView = useCallback(
    (view: { filters: unknown; sort: unknown; columnVisibility: unknown }) => {
      const filtersRaw = view.filters as Record<string, unknown>;
      const newFilters: CrmFilter[] = Object.entries(filtersRaw).map(([field, raw]) => {
        const entry = raw as Record<string, string>;
        return {
          field,
          operator: (entry.operator ?? "is") as CrmFilter["operator"],
          value: entry.value ?? "",
        };
      });
      viewState.setFilters(newFilters);

      const sortRaw = view.sort as Record<string, string>;
      if (sortRaw.field) {
        viewState.setSortState(sortRaw.field, (sortRaw.dir ?? "asc") as "asc" | "desc");
      } else {
        viewState.setSortState("", "asc");
      }

      const colVis = view.columnVisibility as Record<string, boolean>;
      const hidden = new Set(
        Object.entries(colVis)
          .filter(([, visible]) => !visible)
          .map(([key]) => key),
      );
      viewState.setHiddenColumns(hidden);
    },
    [viewState],
  );

  if (isLoading) {
    return <CompaniesTableSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Companies"
        action={
          <CreateCompanyDialog onCreated={() => void utils.crm.companies.list.invalidate()}>
            <Button size="sm"><Plus size={14} className="mr-1" /> New Company</Button>
          </CreateCompanyDialog>
        }
      />
      <CrmViewBar
        viewState={viewState}
        filterDefs={[
          { field: "name", label: "Name", type: "text" },
          { field: "domain", label: "Domain", type: "text" },
          { field: "industry", label: "Industry", type: "text" },
        ]}
        sortFields={[
          { field: "name", label: "Name" },
          { field: "domain", label: "Domain" },
          { field: "industry", label: "Industry" },
          { field: "contacts", label: "Contacts" },
          { field: "createdAt", label: "Created" },
        ]}
        columnDefs={allColumns.map((c) => ({ key: c.key, label: c.label }))}
        entity="companies"
        onApplyView={handleApplyView}
      />
      <CrmRecordTable
        data={filtered}
        columns={allColumns}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/crm/companies/${r.id}`)}
        onSelectionChange={setSelectedIds}
        externalSelectedIds={selectedIds}
        hiddenColumns={viewState.hiddenColumns}
        onToggleColumn={viewState.toggleColumn}
        sort={viewState.sort}
        sortDir={viewState.sortDir}
        onSort={viewState.setSort}
        entity="companies"
        onFieldCreated={() => void utils.crm.companies.list.invalidate()}
        contextMenuItems={(r) => [
          { label: "View details", onClick: () => router.push(`/crm/companies/${r.id}`) },
          { label: "Copy domain", onClick: () => { if (r.domain) void navigator.clipboard.writeText(r.domain); } },
          { label: "Delete", onClick: () => deleteCompany.mutate({ id: r.id }), destructive: true },
        ]}
        emptyIcon={Building2}
        emptyHeading="No companies yet"
        emptyDescription="Add your first company to get started."
        emptyAction={
          <CreateCompanyDialog onCreated={() => void utils.crm.companies.list.invalidate()}>
            <Button size="sm"><Plus size={14} className="mr-1" /> Add Company</Button>
          </CreateCompanyDialog>
        }
      />
      <CrmBulkActionBar
        selectedCount={selectedIds.length}
        totalCount={filtered.length}
        onSelectAll={() => setSelectedIds(filtered.map((c) => c.id))}
        onDeselectAll={() => setSelectedIds([])}
        onDelete={handleBulkDelete}
        isDeleting={deleteCompany.isPending}
        extraActions={
          <>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setBulkEditOpen(true)}>
              <Pencil className="size-3" /> Edit Field
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleExport}>
              <Download className="size-3" /> Export CSV
            </Button>
          </>
        }
      />
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        entity="company"
        selectedIds={selectedIds}
        onSuccess={() => {
          setSelectedIds([]);
          void utils.crm.companies.list.invalidate();
        }}
      />
    </div>
  );
};

function CompaniesTableSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-40 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
      <div className="h-8 w-64 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
      <Card>
        <CardContent className="py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 py-3">
              <div className="size-7 animate-pulse rounded-full bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 w-32 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 w-28 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 w-20 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const CompaniesPage = (): JSX.Element => (
  <Suspense>
    <CompaniesPageContent />
  </Suspense>
);

export default CompaniesPage;
