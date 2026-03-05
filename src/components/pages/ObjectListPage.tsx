import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { DataTable, buildColumnItems } from "@/components/data-table";
import { CreateRecordModal } from "@/components/create-record/CreateRecordModal";
import { CreateAttributeModal } from "@/components/create-attribute/CreateAttributeModal";
import { RecordDetailDeleteDialog } from "@/components/record-detail";
import {
  DealsLayoutToggle,
  ObjectListHeaderActions,
  ObjectListSortFilterPills,
  ObjectListViewTabs,
} from "@/components/object-list";
import { DealsKanbanBoard } from "@/components/deals/DealsKanbanBoard";
import { getRecordValue } from "@/lib/crm/field-mapper";
import { useObject, useAttributes } from "@/hooks/use-object-registry";
import { useRecords, useUpdateRecord, useDeleteRecord } from "@/hooks/use-records";
import { useViews, useViewState } from "@/hooks/use-views";
import { useRenameView, useDeleteView } from "@/hooks/use-view-queries";
import type { ViewSort, ViewFilter } from "@/types/views";
import { usePageTitle, usePageHeaderActions } from "@/contexts/page-header";

/* ------------------------------------------------------------------ */
/*  ObjectListPage                                                     */
/* ------------------------------------------------------------------ */

export function ObjectListPage() {
  const { objectSlug = "" } = useParams<{ objectSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    recordId: number;
    record: Record<string, unknown>;
  } | null>(null);

  const obj = useObject(objectSlug);
  const attributes = useAttributes(objectSlug);

  usePageTitle(obj?.pluralName ?? "");

  const { views, activeView, setActiveView, createView } = useViews(objectSlug);
  const viewState = useViewState(activeView?.id ?? "");
  const renameView = useRenameView(objectSlug);
  const deleteView = useDeleteView(objectSlug);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = parseInt(searchParams.get("perPage") ?? "25", 10) || 25;

  const layout = searchParams.get("layout") === "kanban" ? "kanban" : "table";
  const setLayout = useCallback(
    (newLayout: "table" | "kanban") => {
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
    [setSearchParams],
  );
  const isDeals = objectSlug === "deals";

  const sortParam = useMemo(() => {
    const firstSort = viewState.sorts[0];
    if (!firstSort) return undefined;
    const attr = attributes.find((a) => a.id === firstSort.fieldId);
    return {
      field: attr?.columnName ?? firstSort.fieldId,
      order: firstSort.direction.toUpperCase() as "ASC" | "DESC",
    };
  }, [viewState.sorts, attributes]);

  const viewFilterParams = useMemo(() => {
    if (!viewState.filters.length) return undefined;
    return viewState.filters.map((f) => {
      const attr = attributes.find((a) => a.id === f.fieldId);
      const colName = attr?.columnName ?? f.fieldId;
      return {
        field: colName,
        op: f.operator || "eq",
        value: String(f.value ?? ""),
      };
    });
  }, [viewState.filters, attributes]);

  const { data, isPending, isError } = useRecords(objectSlug, {
    page,
    perPage,
    sort: sortParam,
    viewFilters: viewFilterParams,
  });

  const updateRecord = useUpdateRecord(objectSlug);
  const deleteRecord = useDeleteRecord(objectSlug);

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
      updateRecord.mutate({ id: recordId, data: { [columnName]: value } });
    },
    [updateRecord],
  );

  const handleRowExpand = useCallback(
    (recordId: number) => {
      navigate(`/objects/${objectSlug}/${recordId}`);
    },
    [navigate, objectSlug],
  );

  const handleRowDelete = useCallback(
    (recordId: number, record: Record<string, unknown>) => {
      setDeleteTarget({ recordId, record });
    },
    [],
  );

  const primaryAttr = useMemo(
    () => attributes.find((a) => a.isPrimary),
    [attributes],
  );

  const deleteDisplayName = deleteTarget
    ? (() => {
        if (!primaryAttr) return "Unnamed";
        const val = getRecordValue(deleteTarget.record, primaryAttr.columnName);
        return typeof val === "string" && val ? val : "Unnamed";
      })()
    : "";

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteRecord.mutateAsync(deleteTarget.recordId);
      toast.success(
        `${obj?.singularName ?? "Record"} deleted`,
      );
      setDeleteTarget(null);
    } catch (err) {
      showError(
        err,
        `Failed to delete ${obj?.singularName?.toLowerCase() ?? "record"}`,
      );
    }
  }, [deleteTarget, deleteRecord, obj?.singularName]);

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
    const showTableActions = !(objectSlug === "deals" && layout === "kanban");
    return (
      <ObjectListHeaderActions
        singularName={obj.singularName}
        attributes={attributes}
        columnItems={columnItems}
        viewState={viewState}
        onAddSort={handleAddSort}
        onAddFilter={handleAddFilter}
        onCreateRecord={() => setCreateOpen(true)}
        showTableActions={showTableActions}
      />
    );
  }, [
    obj,
    attributes,
    columnItems,
    viewState,
    handleAddSort,
    handleAddFilter,
    objectSlug,
    layout,
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
      document.title = `${obj.pluralName} | Basics CRM`;
    }
    return () => {
      document.title = "Basics CRM";
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
      <div className="flex min-h-0 flex-1 flex-col gap-3 pt-4">
        {isDeals && (
          <DealsLayoutToggle layout={layout} onLayoutChange={setLayout} />
        )}

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
              isLoading={isPending}
              viewColumns={viewState.columns}
              onCellUpdate={handleCellUpdate}
              onRowExpand={handleRowExpand}
              onRowDelete={handleRowDelete}
              onNewRecord={() => setCreateOpen(true)}
              onAddColumn={() => setAddColumnOpen(true)}
              onColumnResize={(fieldId, width) => {
                const vc = viewState.columns.find((c) => c.fieldId === fieldId);
                if (vc) viewState.updateColumn(vc.id, { width: String(width) });
              }}
              onColumnReorder={(fieldId, newOrder) => {
                const vc = viewState.columns.find((c) => c.fieldId === fieldId);
                if (vc) viewState.updateColumn(vc.id, { order: newOrder });
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

        <CreateAttributeModal
          resource={objectSlug}
          open={addColumnOpen}
          onOpenChange={setAddColumnOpen}
        />

        <RecordDetailDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          displayName={deleteDisplayName}
          onConfirm={handleDeleteConfirm}
          isDeleting={deleteRecord.isPending}
        />
      </div>
    </>
  );
}
