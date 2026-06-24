import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { DataTable, buildColumnItems } from "@/components/data-table";
import { CreateRecordModal } from "@/components/create-record/CreateRecordModal";
import { CreateAttributeModal } from "@/components/create-attribute/CreateAttributeModal";
import { EditAttributeDialog } from "@/components/create-attribute/EditAttributeDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImportWizard } from "@/components/import/ImportWizard";
import {
  RecordBulkDeleteDialog,
  RecordDetailDeleteDialog,
} from "@/components/record-detail";
import {
  DealsLayoutToggle,
  ObjectListHeaderActions,
  ObjectListSortFilterPills,
  ObjectListViewTabs,
} from "@/components/object-list";
import { GridChatBubble } from "@/components/object-list/GridChatBubble";
import { DealsKanbanBoard } from "@/components/deals/DealsKanbanBoard";
import {
  getNameAttributes,
  getRecordDisplayName,
  parseCombinedName,
} from "@/lib/crm/display-name";
import {
  buildAttributeWritePayload,
  buildRecordWritePayload,
  normalizeFilterOperator,
  normalizeFilterValue,
} from "@/lib/crm/field-utils";
import { useObject, useAttributes, useDeleteObject } from "@/hooks/use-object-registry";
import {
  useRecords,
  useUpdateRecord,
  useDeleteRecord,
  useRefreshCrm,
} from "@/hooks/use-records";
import { useDeleteColumn } from "@/hooks/use-columns";
import { useViews, useViewState } from "@/hooks/use-views";
import { useRenameView, useDeleteView } from "@/hooks/use-view-queries";
import type { ViewSort, ViewFilter } from "@/types/views";
import { usePageTitle, usePageHeaderActions } from "@/contexts/page-header";
import { useEmailSyncStatus } from "@/hooks/use-email-sync";
import { SuggestedContactsSheet } from "@/components/email-sync/SuggestedContactsSheet";
import { FindFromEmailDialog } from "@/components/email-sync/FindFromEmailDialog";
import {
  SparkleIcon,
  XIcon,
  BuildingsIcon,
  DotsThreeIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMe } from "@/hooks/use-me";
import { TypeToConfirmDeleteDialog } from "@/components/TypeToConfirmDeleteDialog";
import { ContextMenuItem } from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  ObjectListPage                                                     */
/* ------------------------------------------------------------------ */

export function ObjectListPage() {
  const { objectSlug = "" } = useParams<{ objectSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editAttrFieldId, setEditAttrFieldId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    recordId: number;
    record: Record<string, unknown>;
  } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [rowSelectionClearKey, setRowSelectionClearKey] = useState(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [suggestionsSheetOpen, setSuggestionsSheetOpen] = useState(false);
  const [findFromEmailOpen, setFindFromEmailOpen] = useState(false);
  const [suggestionsBannerDismissed, setSuggestionsBannerDismissed] =
    useState(() => localStorage.getItem("email-suggestions-banner-dismissed") === "true");
  const [dealBannerDismissed, setDealBannerDismissed] =
    useState(() => localStorage.getItem("deal-suggestions-banner-dismissed") === "true");

  const obj = useObject(objectSlug);
  const attributes = useAttributes(objectSlug);
  // Only CUSTOM objects (custom_* tables) can be deleted, and only by admins —
  // built-in CRM objects are structural and the server rejects deleting them.
  const me = useMe();
  const isAdmin = Boolean(me.data?.administrator);
  const isCustomObject = Boolean(obj?.tableName?.startsWith("custom_"));
  const deleteObject = useDeleteObject();
  const [deleteObjectOpen, setDeleteObjectOpen] = useState(false);
  const onDeleteObject = async () => {
    if (!obj) return;
    try {
      await deleteObject.mutateAsync(objectSlug);
      toast.success(`Deleted "${obj.pluralName}"`);
      navigate("/home");
    } catch (e) {
      showError(e);
    }
  };
  const isContacts = objectSlug === "contacts";
  const isDealsObj = objectSlug === "deals";
  const enableRowMultiSelect =
    objectSlug === "contacts" ||
    objectSlug === "companies" ||
    objectSlug === "deals";
  const { data: syncStatus } = useEmailSyncStatus();
  const pendingSuggestions =
    isContacts && !suggestionsBannerDismissed
      ? (syncStatus?.pendingSuggestions ?? 0)
      : 0;
  const pendingDealSuggestions =
    isDealsObj && !dealBannerDismissed
      ? (syncStatus?.pendingDealSuggestions ?? 0)
      : 0;

  usePageTitle(obj?.pluralName ?? "");

  const { views, activeView, setActiveView, createView } = useViews(objectSlug);
  const viewState = useViewState(activeView?.id ?? "");
  const renameView = useRenameView(objectSlug);
  const deleteView = useDeleteView(objectSlug);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = parseInt(searchParams.get("perPage") ?? "25", 10) || 25;

  const isDeals = objectSlug === "deals";
  const layoutKey = `basics-os:layout:${objectSlug}`;
  const layout = (() => {
    const fromParams = searchParams.get("layout");
    if (fromParams === "kanban") return "kanban" as const;
    if (fromParams === "table") return "table" as const;
    if (isDeals) {
      try {
        const stored = localStorage.getItem(layoutKey);
        if (stored === "kanban") return "kanban" as const;
      } catch {
        /* ignore */
      }
    }
    return "table" as const;
  })();
  const setLayout = useCallback(
    (newLayout: "table" | "kanban") => {
      try {
        localStorage.setItem(layoutKey, newLayout);
      } catch {
        /* ignore */
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newLayout === "kanban") next.set("layout", "kanban");
          else next.delete("layout");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, layoutKey],
  );

  const sortParam = useMemo(
    () =>
      viewState.sorts
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((sort) => {
          const attr = attributes.find((a) => a.id === sort.fieldId);
          return {
            field: attr?.columnName ?? sort.fieldId,
            order: sort.direction.toUpperCase() as "ASC" | "DESC",
          };
        }),
    [viewState.sorts, attributes],
  );

  const viewFilterParams = useMemo(() => {
    if (!viewState.filters.length) return undefined;
    return viewState.filters.map((f) => {
      const attr = attributes.find((a) => a.id === f.fieldId);
      const colName = attr?.columnName ?? f.fieldId;
      return {
        field: colName,
        op: attr
          ? normalizeFilterOperator(f.operator || "eq", attr)
          : f.operator || "eq",
        value: attr
          ? normalizeFilterValue(f.operator || "eq", f.value, attr)
          : String(f.value ?? ""),
        logicalOp: f.logicalOp,
      };
    });
  }, [viewState.filters, attributes]);

  const { data, isPending, isFetching, isError } = useRecords(objectSlug, {
    page,
    perPage,
    sort: sortParam,
    viewFilters: viewFilterParams,
  });

  const updateRecord = useUpdateRecord(objectSlug);
  const deleteRecord = useDeleteRecord(objectSlug);
  const refreshCrm = useRefreshCrm(objectSlug);
  const deleteColumn = useDeleteColumn();

  const handlePaginationChange = useCallback(
    (newPage: number, newPerPage: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("page", String(newPage));
          next.set("perPage", String(newPerPage));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleCellUpdate = useCallback(
    (recordId: number, columnName: string, value: unknown) => {
      const attribute = attributes.find(
        (attr) => attr.columnName === columnName,
      );
      if (!attribute) return;

      const { firstNameAttr, lastNameAttr, usesSplitName } =
        getNameAttributes(attributes);

      if (
        usesSplitName &&
        firstNameAttr &&
        attribute.columnName === firstNameAttr.columnName
      ) {
        const parsed = parseCombinedName(value);
        updateRecord.mutate({
          id: recordId,
          data: buildRecordWritePayload(attributes, {
            [firstNameAttr.columnName]: parsed.firstName,
            ...(lastNameAttr && { [lastNameAttr.columnName]: parsed.lastName }),
          }),
        });
        return;
      }

      updateRecord.mutate({
        id: recordId,
        data: buildAttributeWritePayload(attribute, value),
      });
    },
    [attributes, updateRecord],
  );

  const handleRowExpand = useCallback(
    (recordId: number) => {
      navigate(`/objects/${objectSlug}/${recordId}`);
    },
    [navigate, objectSlug],
  );

  const dealsExtraContextMenuItems = useCallback(
    (record: Record<string, unknown>): ReactNode => {
      const companyId = (record.companyId ?? record.company_id) as number | null | undefined;
      const companyName = (record.companyName ?? record.company_name) as string | null | undefined;
      if (!companyId) return null;
      return (
        <ContextMenuItem onClick={() => navigate(`/objects/companies/${companyId}`)}>
          <BuildingsIcon className="mr-2 h-4 w-4" />
          Open company{companyName ? `: ${companyName}` : ""}
        </ContextMenuItem>
      );
    },
    [navigate],
  );

  const handleRowDelete = useCallback(
    (recordId: number, record: Record<string, unknown>) => {
      setDeleteTarget({ recordId, record });
    },
    [],
  );

  const deleteDisplayName = deleteTarget
    ? (() => {
        return getRecordDisplayName(deleteTarget.record, attributes);
      })()
    : "";

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteRecord.mutateAsync(deleteTarget.recordId);
      toast.success(`${obj?.singularName ?? "Record"} deleted`);
      setDeleteTarget(null);
    } catch (err) {
      showError(
        err,
        `Failed to delete ${obj?.singularName?.toLowerCase() ?? "record"}`,
      );
    }
  }, [deleteTarget, deleteRecord, obj?.singularName]);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (!bulkDeleteIds?.length) return;
    setBulkDeleting(true);
    try {
      const batchSize = 5;
      for (let i = 0; i < bulkDeleteIds.length; i += batchSize) {
        const batch = bulkDeleteIds.slice(i, i + batchSize);
        await Promise.all(batch.map((id) => deleteRecord.mutateAsync(id)));
      }
      toast.success(
        `Deleted ${bulkDeleteIds.length} ${obj?.pluralName?.toLowerCase() ?? "records"}`,
      );
      setBulkDeleteIds(null);
      setRowSelectionClearKey((k) => k + 1);
    } catch (err) {
      showError(
        err,
        `Failed to delete some ${obj?.pluralName?.toLowerCase() ?? "records"}`,
      );
    } finally {
      setBulkDeleting(false);
    }
  }, [bulkDeleteIds, deleteRecord, obj?.pluralName]);

  const handleAddSort = useCallback(
    (sort: Omit<ViewSort, "id">) => {
      viewState.addSort(sort.fieldId, sort.direction);
    },
    [viewState],
  );

  const handleAddFilter = useCallback(
    (filter: Omit<ViewFilter, "id">) => {
      viewState.addFilter(
        filter.fieldId,
        filter.operator,
        filter.value,
        filter.logicalOp,
      );
    },
    [viewState],
  );

  const columnItems = useMemo(
    () => buildColumnItems(viewState.columns, attributes),
    [viewState.columns, attributes],
  );
  const attrMap = useMemo(
    () => new Map(attributes.map((a) => [a.id, a])),
    [attributes],
  );

  const headerActionsNode = useMemo(() => {
    if (!obj) return null;
    return (
      <>
        {isDeals && (
          <DealsLayoutToggle layout={layout} onLayoutChange={setLayout} />
        )}
        <ObjectListHeaderActions
          singularName={obj.singularName}
          attributes={attributes}
          columnItems={columnItems}
          viewState={viewState}
          onAddSort={handleAddSort}
          onAddFilter={handleAddFilter}
          onCreateRecord={() => setCreateOpen(true)}
          onAddColumn={() => setAddColumnOpen(true)}
          onImport={() => setImportOpen(true)}
          onRefresh={refreshCrm}
          isRefreshing={isFetching}
          onFindFromEmail={
            isContacts ? () => setFindFromEmailOpen(true) : undefined
          }
        />
        {isAdmin && isCustomObject && obj ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                title={`${obj.pluralName} settings`}
              >
                <DotsThreeIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteObjectOpen(true)}
              >
                <TrashIcon className="mr-2 size-4" />
                Delete {obj.pluralName}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </>
    );
  }, [
    obj,
    attributes,
    columnItems,
    viewState,
    handleAddSort,
    handleAddFilter,
    layout,
    isDeals,
    setLayout,
    isFetching,
    refreshCrm,
    isContacts,
    isAdmin,
    isCustomObject,
  ]);

  const headerActionsPortal = usePageHeaderActions(headerActionsNode);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setCreateOpen(true);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("create");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (obj) {
      document.title = `${obj.pluralName} | Basics OS`;
    }
    return () => {
      document.title = "Basics OS";
    };
  }, [obj]);

  if (!obj) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-medium">Object not found</p>
        <p className="text-sm text-muted-foreground">
          No object with slug &ldquo;{objectSlug}&rdquo; exists.
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-destructive">
        Failed to load {obj.pluralName.toLowerCase()}.
      </div>
    );
  }

  const records = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasActiveSorts = viewState.sorts.length > 0;
  const hasActiveFilters = viewState.filters.length > 0;
  const defaultViewId =
    views.find((v) => v.isDefault)?.id ?? views[0]?.id ?? "";

  return (
    <>
      {headerActionsPortal}
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {views.length > 0 && layout !== "kanban" && (
          <ObjectListViewTabs
            views={views}
            activeViewId={activeView?.id ?? ""}
            defaultViewId={defaultViewId}
            onSelectView={setActiveView}
            onCreateView={() =>
              createView
                .mutateAsync({ title: "New View" })
                .then((newView) => setActiveView(newView.id))
                .catch(() => {})
            }
            onRenameView={async (viewId, title) => {
              await renameView.mutateAsync({ viewId, title }).catch(() => {});
            }}
            onDeleteView={(viewId) =>
              deleteView
                .mutateAsync(viewId)
                .then(() => {
                  const defaultView =
                    views.find((v) => v.isDefault) ?? views[0];
                  if (defaultView && defaultView.id !== viewId) {
                    setActiveView(defaultView.id);
                  }
                })
                .catch(() => {})
            }
          />
        )}

        {layout !== "kanban" &&
          activeView &&
          attributes.length > 0 &&
          (hasActiveSorts || hasActiveFilters) && (
            <ObjectListSortFilterPills
              sorts={viewState.sorts}
              filters={viewState.filters}
              attrMap={attrMap}
              onRemoveSort={viewState.removeSort}
              onRemoveFilter={viewState.removeFilter}
            />
          )}

        {pendingSuggestions > 0 && (
          <div className="mx-1 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-900 dark:bg-blue-950/30">
            <SparkleIcon className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="text-sm">
              <strong>{pendingSuggestions}</strong> contact
              {pendingSuggestions !== 1 ? "s" : ""} discovered from your email
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setSuggestionsSheetOpen(true)}
            >
              Review
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground"
              onClick={() => {
                localStorage.setItem("email-suggestions-banner-dismissed", "true");
                setSuggestionsBannerDismissed(true);
              }}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        )}

        {pendingDealSuggestions > 0 && (
          <div className="mx-1 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-900 dark:bg-amber-950/30">
            <SparkleIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-sm">
              <strong>{pendingDealSuggestions}</strong> potential deal
              {pendingDealSuggestions !== 1 ? "s" : ""} discovered from your
              email
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => navigate("/home")}
            >
              Review
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground"
              onClick={() => {
                localStorage.setItem("deal-suggestions-banner-dismissed", "true");
                setDealBannerDismissed(true);
              }}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          {isDeals && layout === "kanban" ? (
            <DealsKanbanBoard />
          ) : (
            <DataTable
              objectSlug={objectSlug}
              singularName={obj.singularName}
              pluralName={obj.pluralName}
              attributes={attributes}
              data={records}
              total={total}
              isLoading={isPending || viewState.isLoading}
              viewColumns={viewState.columns}
              onCellUpdate={handleCellUpdate}
              onRowExpand={handleRowExpand}
              onRowDelete={handleRowDelete}
              extraContextMenuItems={isDeals ? dealsExtraContextMenuItems : undefined}
              enableRowMultiSelect={enableRowMultiSelect}
              selectionClearKey={rowSelectionClearKey}
              onBulkDeleteRequest={(ids) => setBulkDeleteIds(ids)}
              onNewRecord={() => setCreateOpen(true)}
              onAddColumn={() => setAddColumnOpen(true)}
              onColumnResize={(fieldId, width) => {
                const vc = viewState.columns.find((c) => c.fieldId === fieldId);
                if (vc) viewState.updateColumn(vc.id, { width: String(width) });
              }}
              onSwapColumns={(fieldIdA, fieldIdB) => {
                const vcA = viewState.columns.find(
                  (c) => c.fieldId === fieldIdA,
                );
                const vcB = viewState.columns.find(
                  (c) => c.fieldId === fieldIdB,
                );
                if (vcA && vcB) {
                  const orderA = vcA.order;
                  const orderB = vcB.order;
                  viewState.updateColumn(vcA.id, { order: orderB });
                  viewState.updateColumn(vcB.id, { order: orderA });
                }
              }}
              onAddSort={(fieldId, direction) => {
                viewState.replaceSort(fieldId, direction);
              }}
              onHideColumn={(fieldId) => {
                const vc = viewState.columns.find((c) => c.fieldId === fieldId);
                if (vc) viewState.updateColumn(vc.id, { show: false });
              }}
              onRenameColumn={(fieldId, title) => {
                const vc = viewState.columns.find((c) => c.fieldId === fieldId);
                if (vc) viewState.updateColumn(vc.id, { title });
              }}
              onEditAttribute={(fieldId) => setEditAttrFieldId(fieldId)}
              onDeleteColumn={(fieldId) => {
                if (
                  window.confirm(
                    "Delete this field? It's removed from the grid for everyone. Existing record values are kept and reappear if you re-add the field.",
                  )
                ) {
                  deleteColumn.mutate(
                    { columnId: fieldId, resource: objectSlug },
                    {
                      onSuccess: () => toast.success("Field deleted"),
                      onError: (e) => showError(e),
                    },
                  );
                }
              }}
              onShowColumn={(fieldId) => {
                const vc = viewState.columns.find((c) => c.fieldId === fieldId);
                if (vc) {
                  viewState.updateColumn(vc.id, { show: true });
                } else {
                  viewState.updateColumn(`virtual-${fieldId}`, { show: true });
                }
              }}
              pagination={{ page, perPage }}
              onPaginationChange={handlePaginationChange}
              sorts={viewState.sorts}
              filters={viewState.filters}
            />
          )}
        </div>

        <CreateRecordModal
          objectSlug={objectSlug}
          objectName={obj.singularName}
          attributes={attributes}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import CSV</DialogTitle>
              <DialogDescription>
                Import a CSV into {obj?.pluralName ?? objectSlug}. Columns
                auto-map by header; new fields are created as needed.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] min-w-0 overflow-y-auto pr-1">
              <ImportWizard
                initialObjectSlug={objectSlug}
                onComplete={() => {
                  setImportOpen(false);
                  refreshCrm();
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        <CreateAttributeModal
          resource={objectSlug}
          open={addColumnOpen}
          onOpenChange={setAddColumnOpen}
          onCreated={(column) => {
            viewState.updateColumn(`virtual-${column.id}`, {
              show: true,
              title: column.title,
            });
          }}
        />

        <RecordDetailDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          displayName={deleteDisplayName}
          onConfirm={handleDeleteConfirm}
          isDeleting={deleteRecord.isPending}
        />

        <RecordBulkDeleteDialog
          open={bulkDeleteIds != null && bulkDeleteIds.length > 0}
          onOpenChange={(open) => !open && setBulkDeleteIds(null)}
          count={bulkDeleteIds?.length ?? 0}
          singularName={obj.singularName}
          pluralName={obj.pluralName}
          onConfirm={handleBulkDeleteConfirm}
          isDeleting={bulkDeleting}
        />

        <EditAttributeDialog
          attribute={
            editAttrFieldId
              ? (attributes.find((a) => a.id === editAttrFieldId) ?? null)
              : null
          }
          objectSlug={objectSlug}
          open={editAttrFieldId != null}
          onOpenChange={(open) => !open && setEditAttrFieldId(null)}
        />

        {isContacts && (
          <>
            <SuggestedContactsSheet
              open={suggestionsSheetOpen}
              onOpenChange={setSuggestionsSheetOpen}
            />
            <FindFromEmailDialog
              open={findFromEmailOpen}
              onOpenChange={setFindFromEmailOpen}
            />
          </>
        )}
      </div>
      {obj ? (
        <GridChatBubble
          objectSlug={objectSlug}
          singular={obj.singularName}
          plural={obj.pluralName}
        />
      ) : null}

      {obj ? (
        <TypeToConfirmDeleteDialog
          open={deleteObjectOpen}
          onOpenChange={setDeleteObjectOpen}
          name={obj.pluralName}
          title={`Delete the ${obj.pluralName} object?`}
          description={
            <>
              This permanently deletes the{" "}
              <span className="font-medium text-foreground">{obj.pluralName}</span> grid and{" "}
              <span className="font-medium text-foreground">ALL its records</span> for everyone in
              the organization. This cannot be undone.
            </>
          }
          confirmLabel={`Delete ${obj.pluralName}`}
          onConfirm={onDeleteObject}
          pending={deleteObject.isPending}
        />
      ) : null}
    </>
  );
}
