"use client";

import { Suspense, useEffect, useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  PageHeader,
  Button,
  Badge,
  Card,
  CardContent,
  addToast,
} from "@basicsos/ui";
import { Plus, Briefcase, Activity, DollarSign, BarChart3, Users, Building2, Calendar, Download, ChevronDown, AlertCircle } from "@basicsos/ui";
import { CrmRecordTable } from "../components/CrmRecordTable";
import type { ColumnDef } from "../components/CrmRecordTable";
import { CrmViewBar } from "../components/CrmViewBar";
import { CrmBulkActionBar } from "../components/CrmBulkActionBar";
import { useCrmViewState, applyCrmFilters } from "../hooks/useCrmViewState";
import type { CrmFilter } from "../hooks/useCrmViewState";
import { CreateDealDialog } from "../CreateDealDialog";
import { DealKanbanColumn } from "../DealKanbanColumn";
import { STAGES, STAGE_COLORS, formatCurrency, exportCsv } from "../utils";
import type { DealStage } from "../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@basicsos/ui";

interface FlatDeal {
  id: string;
  title: string;
  stage: string;
  value: string | null;
  probability: number | null;
  contactId: string | null;
  companyId: string | null;
  closeDate: Date | string | null;
}

const DealsPageContent = (): JSX.Element => {
  const router = useRouter();
  const utils = trpc.useUtils();
  const viewState = useCrmViewState();
  const { data: dealsData, isLoading } = trpc.crm.deals.listByStage.useQuery();
  const { data: contactsData } = trpc.crm.contacts.list.useQuery({});
  const { data: companiesData } = trpc.crm.companies.list.useQuery();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const updateStage = trpc.crm.deals.updateStage.useMutation({
    onSuccess: () => {
      void utils.crm.deals.listByStage.invalidate();
      addToast({ title: "Deal moved", variant: "success" });
    },
    onError: (err) => {
      addToast({ title: "Move failed", description: err.message, variant: "destructive" });
    },
  });

  const updateDeal = trpc.crm.deals.update.useMutation({
    onSuccess: () => void utils.crm.deals.listByStage.invalidate(),
    onError: (err) => addToast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const deleteDeal = trpc.crm.deals.delete.useMutation({
    onSuccess: () => {
      void utils.crm.deals.listByStage.invalidate();
      addToast({ title: "Deleted", variant: "success" });
    },
  });

  useEffect(() => {
    const handler = (e: Event): void => {
      const { dealId, stage } = (e as CustomEvent<{ dealId: string; stage: string }>).detail;
      updateStage.mutate({ id: dealId, stage });
    };
    document.addEventListener("deal:move", handler);
    return () => document.removeEventListener("deal:move", handler);
  }, [updateStage]);

  const contactMap = useMemo(() => {
    const map = new Map<string, string>();
    (contactsData ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [contactsData]);

  const companyMap = useMemo(() => {
    const map = new Map<string, string>();
    (companiesData ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [companiesData]);

  const allDeals = useMemo(
    (): FlatDeal[] => (dealsData ?? []).flatMap((g) => g.deals) as FlatDeal[],
    [dealsData],
  );

  const filtered = useMemo(
    () =>
      applyCrmFilters(
        allDeals,
        viewState,
        ["title"],
        (row: FlatDeal, field: string) => {
          if (field === "title") return row.title.toLowerCase();
          if (field === "stage") return row.stage;
          if (field === "value") return Number(row.value ?? 0);
          if (field === "probability") return row.probability ?? 0;
          if (field === "contact") return (contactMap.get(row.contactId ?? "") ?? "").toLowerCase();
          if (field === "company") return (companyMap.get(row.companyId ?? "") ?? "").toLowerCase();
          if (field === "closeDate") return row.closeDate ? new Date(row.closeDate).getTime() : 0;
          if (field === "overdue") {
            const isOverdue =
              !!row.closeDate &&
              new Date(row.closeDate) < new Date() &&
              row.stage !== "won" &&
              row.stage !== "lost";
            return isOverdue ? "true" : "false";
          }
          return "";
        },
      ),
    [allDeals, viewState, contactMap, companyMap],
  );

  const handleEdit = useCallback(
    (id: string, field: string, value: string) => {
      if (field === "stage") {
        updateStage.mutate({ id, stage: value });
        return;
      }
      const payload: Record<string, string | number> = { id };
      if (field === "title") payload.title = value;
      else if (field === "value") payload.value = value;
      else if (field === "probability") payload.probability = Number(value);
      updateDeal.mutate(payload as Parameters<typeof updateDeal.mutate>[0]);
    },
    [updateStage, updateDeal],
  );

  const columns: ColumnDef<FlatDeal>[] = useMemo(
    () => [
      {
        key: "title",
        label: "Title",
        icon: Briefcase,
        sortable: true,
        sortValue: (r: FlatDeal) => r.title.toLowerCase(),
        render: (r: FlatDeal) => <span className="font-medium text-foreground">{r.title}</span>,
        editable: true,
        editType: "text",
        onEdit: (id: string, value: string) => handleEdit(id, "title", value),
      },
      {
        key: "stage",
        label: "Stage",
        icon: Activity,
        sortable: true,
        sortValue: (r: FlatDeal) => STAGES.indexOf(r.stage as DealStage),
        render: (r: FlatDeal) => {
          const color = STAGE_COLORS[r.stage] ?? "bg-stone-400";
          return (
            <div className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${color}`} />
              <Badge variant="outline" className="capitalize text-xs">{r.stage}</Badge>
            </div>
          );
        },
        editable: true,
        editType: "select",
        editOptions: STAGES.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s })),
        onEdit: (id: string, value: string) => handleEdit(id, "stage", value),
      },
      {
        key: "value",
        label: "Value",
        icon: DollarSign,
        sortable: true,
        sortValue: (r: FlatDeal) => Number(r.value ?? 0),
        align: "right",
        render: (r: FlatDeal) => (
          <span className="font-medium tabular-nums">{formatCurrency(Number(r.value ?? 0))}</span>
        ),
        editable: true,
        editType: "number",
        onEdit: (id: string, value: string) => handleEdit(id, "value", value),
      },
      {
        key: "probability",
        label: "Prob.",
        icon: BarChart3,
        sortable: true,
        sortValue: (r: FlatDeal) => r.probability ?? 0,
        render: (r: FlatDeal) => <span className="text-sm tabular-nums">{r.probability ?? 50}%</span>,
        editable: true,
        editType: "number",
        onEdit: (id: string, value: string) => handleEdit(id, "probability", value),
      },
      {
        key: "contact",
        label: "Contact",
        icon: Users,
        sortable: true,
        sortValue: (r: FlatDeal) => (contactMap.get(r.contactId ?? "") ?? "").toLowerCase(),
        render: (r: FlatDeal) => {
          const name = contactMap.get(r.contactId ?? "");
          return name ? (
            <Badge variant="secondary" className="text-xs">{name}</Badge>
          ) : (
            <span className="text-muted-foreground">{"\u2014"}</span>
          );
        },
      },
      {
        key: "company",
        label: "Company",
        icon: Building2,
        sortable: true,
        sortValue: (r: FlatDeal) => (companyMap.get(r.companyId ?? "") ?? "").toLowerCase(),
        render: (r: FlatDeal) => {
          const name = companyMap.get(r.companyId ?? "");
          return name ? (
            <Badge variant="secondary" className="text-xs">{name}</Badge>
          ) : (
            <span className="text-muted-foreground">{"\u2014"}</span>
          );
        },
      },
      {
        key: "closeDate",
        label: "Close Date",
        icon: Calendar,
        sortable: true,
        sortValue: (r: FlatDeal) => (r.closeDate ? new Date(r.closeDate).getTime() : 0),
        render: (r: FlatDeal) => {
          if (!r.closeDate) return <span className="text-muted-foreground">{"\u2014"}</span>;
          const isOverdue =
            new Date(r.closeDate) < new Date() &&
            r.stage !== "won" &&
            r.stage !== "lost";
          return (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {new Date(r.closeDate).toLocaleDateString()}
              </span>
              {isOverdue && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                  Overdue
                </Badge>
              )}
            </div>
          );
        },
      },
    ],
    [contactMap, companyMap, handleEdit],
  );

  const handleBulkDelete = useCallback(() => {
    Promise.all(selectedIds.map((id) => deleteDeal.mutateAsync({ id }))).then(() => {
      setSelectedIds([]);
    }).catch(() => {
      addToast({ title: "Some deletions failed", variant: "destructive" });
    });
  }, [selectedIds, deleteDeal]);

  const handleBulkStageChange = useCallback(
    (stage: string) => {
      Promise.all(selectedIds.map((id) => updateStage.mutateAsync({ id, stage }))).then(() => {
        setSelectedIds([]);
        addToast({ title: `Moved ${selectedIds.length} deal${selectedIds.length !== 1 ? "s" : ""} to ${stage}`, variant: "success" });
      }).catch(() => {
        addToast({ title: "Some moves failed", variant: "destructive" });
      });
    },
    [selectedIds, updateStage],
  );

  const handleExport = useCallback(() => {
    const selected = filtered.filter((d) => selectedIds.includes(d.id));
    exportCsv(
      selected,
      [
        { key: "title", label: "Title", value: (r) => r.title },
        { key: "stage", label: "Stage", value: (r) => r.stage },
        { key: "value", label: "Value", value: (r) => String(r.value ?? 0) },
        { key: "probability", label: "Probability", value: (r) => String(r.probability ?? 50) },
        { key: "contact", label: "Contact", value: (r) => contactMap.get(r.contactId ?? "") ?? "" },
        { key: "company", label: "Company", value: (r) => companyMap.get(r.companyId ?? "") ?? "" },
        { key: "closeDate", label: "Close Date", value: (r) => r.closeDate ? new Date(r.closeDate).toLocaleDateString() : "" },
      ],
      "deals-export",
    );
  }, [filtered, selectedIds, contactMap, companyMap]);

  const stageFilterOptions = STAGES.map((s) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1),
    value: s,
  }));

  const handleApplyView = useCallback(
    (view: { filters: unknown; sort: unknown; columnVisibility: unknown }) => {
      // Reconstruct filters from saved payload: { [field]: { operator, value } }
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

      // Reconstruct sort from saved payload: { field, dir }
      const sortRaw = view.sort as Record<string, string>;
      if (sortRaw.field) {
        viewState.setSortState(sortRaw.field, (sortRaw.dir ?? "asc") as "asc" | "desc");
      } else {
        viewState.setSortState("", "asc");
      }

      // Reconstruct hidden columns from saved payload: { [colKey]: boolean }
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
    return <DealsTableSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Deals"
        action={
          <CreateDealDialog onCreated={() => void utils.crm.deals.listByStage.invalidate()}>
            <Button size="sm"><Plus size={14} className="mr-1" /> New Deal</Button>
          </CreateDealDialog>
        }
      />
      {overdueCount > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant={isOverdueFilterActive ? "destructive" : "outline"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => {
              if (isOverdueFilterActive) {
                viewState.removeFilter("overdue");
              } else {
                viewState.addFilter({ field: "overdue", operator: "is", value: "true" });
              }
            }}
          >
            <AlertCircle className="size-3" />
            Overdue
            <Badge
              variant={isOverdueFilterActive ? "outline" : "destructive"}
              className="ml-0.5 h-4 px-1 text-[10px] py-0"
            >
              {overdueCount}
            </Badge>
          </Button>
        </div>
      )}
      <CrmViewBar
        viewState={viewState}
        filterDefs={[
          { field: "stage", label: "Stage", type: "select", options: stageFilterOptions },
          { field: "title", label: "Title", type: "text" },
        ]}
        sortFields={[
          { field: "title", label: "Title" },
          { field: "stage", label: "Stage" },
          { field: "value", label: "Value" },
          { field: "probability", label: "Probability" },
          { field: "closeDate", label: "Close Date" },
        ]}
        columnDefs={columns.map((c) => ({ key: c.key, label: c.label }))}
        showViewToggle
        entity="deals"
        onApplyView={handleApplyView}
      />
      {viewState.viewType === "table" ? (
        <>
          <CrmRecordTable
            data={filtered}
            columns={columns}
            getRowId={(r) => r.id}
            onRowClick={(r) => router.push(`/crm/deals/${r.id}`)}
            onSelectionChange={setSelectedIds}
            hiddenColumns={viewState.hiddenColumns}
            sort={viewState.sort}
            sortDir={viewState.sortDir}
            onSort={viewState.setSort}
            contextMenuItems={(r) => [
              { label: "View details", onClick: () => router.push(`/crm/deals/${r.id}`) },
              { label: "Delete", onClick: () => deleteDeal.mutate({ id: r.id }), destructive: true },
            ]}
            emptyIcon={Briefcase}
            emptyHeading="No deals yet"
            emptyDescription="Create your first deal to start tracking your pipeline."
            emptyAction={
              <CreateDealDialog onCreated={() => void utils.crm.deals.listByStage.invalidate()}>
                <Button size="sm"><Plus size={14} className="mr-1" /> New Deal</Button>
              </CreateDealDialog>
            }
          />
          <CrmBulkActionBar
            selectedCount={selectedIds.length}
            totalCount={filtered.length}
            onSelectAll={() => setSelectedIds(filtered.map((d) => d.id))}
            onDeselectAll={() => setSelectedIds([])}
            onDelete={handleBulkDelete}
            isDeleting={deleteDeal.isPending}
            extraActions={
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      Move to <ChevronDown className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {STAGES.map((s) => (
                      <DropdownMenuItem key={s} onSelect={() => handleBulkStageChange(s)} className="capitalize">
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleExport}>
                  <Download className="size-3" /> Export CSV
                </Button>
              </>
            }
          />
        </>
      ) : (
        <KanbanView dealsData={dealsData ?? []} />
      )}
    </div>
  );
};

function KanbanView({
  dealsData,
}: {
  dealsData: Array<{ stage: string; deals: Array<{ id: string; title: string; stage: string; value: string | null; probability: number | null }> }>;
}): JSX.Element {
  return (
    <div className="overflow-x-auto -mx-1">
      <div className="flex gap-4 min-w-max pb-4">
        {STAGES.map((stage) => {
          const stageGroup = dealsData.find((g) => g.stage === stage);
          const stageDeals = (stageGroup?.deals ?? []).map((d) => ({
            id: d.id,
            title: d.title,
            stage: d.stage as DealStage,
            value: String(d.value ?? 0),
            probability: d.probability ?? 50,
          }));
          return <DealKanbanColumn key={stage} stage={stage} deals={stageDeals} />;
        })}
      </div>
    </div>
  );
}

function DealsTableSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-28 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
      <div className="h-8 w-64 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
      <Card>
        <CardContent className="py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 py-3">
              <div className="h-4 w-36 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 w-20 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 w-16 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 w-12 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const DealsPage = (): JSX.Element => (
  <Suspense>
    <DealsPageContent />
  </Suspense>
);

export default DealsPage;
