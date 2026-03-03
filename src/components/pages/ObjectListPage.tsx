import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  ViewSelector,
  DataTableToolbar,
  ViewSaveBar,
} from "@/components/data-table";
import { CreateRecordModal } from "@/components/create-record/CreateRecordModal";
import { CreateAttributeModal } from "@/components/create-attribute/CreateAttributeModal";
import { useObject, useAttributes } from "@/hooks/use-object-registry";
import { useRecords, useUpdateRecord, useDeleteRecord } from "@/hooks/use-records";
import { useViews, useViewState } from "@/hooks/use-views";
import { getObjectIcon } from "@/lib/object-icon-map";
import type { ViewSort, ViewFilter } from "@/types/views";
import { usePageTitle } from "@/contexts/page-header";

/* ------------------------------------------------------------------ */
/*  ObjectListPage                                                     */
/* ------------------------------------------------------------------ */

export function ObjectListPage() {
  const { objectSlug = "" } = useParams<{ objectSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  const obj = useObject(objectSlug);
  const attributes = useAttributes(objectSlug);

  // Register current object name in the layout header
  usePageTitle(obj?.pluralName ?? "");

  // Views
  const {
    views,
    activeView,
    setActiveView,
    createView,
  } = useViews(objectSlug);

  // View state (columns, sorts, filters, dirty tracking)
  const viewState = useViewState(activeView?.id ?? "");

  // Pagination from URL
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = parseInt(searchParams.get("perPage") ?? "25", 10) || 25;

  // Build sort param for record fetching from view state sorts
  const sortParam = useMemo(() => {
    const firstSort = viewState.sorts[0];
    if (!firstSort) return undefined;
    // Map fieldId (column ID) to column name via attributes
    const attr = attributes.find((a) => a.id === firstSort.fieldId);
    return {
      field: attr?.columnName ?? firstSort.fieldId,
      order: firstSort.direction.toUpperCase() as "ASC" | "DESC",
    };
  }, [viewState.sorts, attributes]);

  // View-level filters as generic filter array for the API
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

  // Fetch records
  const { data, isPending, isError } = useRecords(objectSlug, {
    page,
    perPage,
    sort: sortParam,
    viewFilters: viewFilterParams,
  });

  const updateRecord = useUpdateRecord(objectSlug);
  const deleteRecord = useDeleteRecord(objectSlug);

  // Pagination handler
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

  // Cell update handler
  const handleCellUpdate = useCallback(
    (recordId: number, columnName: string, value: any) => {
      updateRecord.mutate({ id: recordId, data: { [columnName]: value } });
    },
    [updateRecord],
  );

  // Row delete handler
  const handleRowDelete = useCallback(
    async (ids: number[]) => {
      for (const id of ids) {
        await deleteRecord.mutateAsync(id);
      }
    },
    [deleteRecord],
  );

  // Row expand -> navigate to detail page
  const handleRowExpand = useCallback(
    (recordId: number) => {
      navigate(`/objects/${objectSlug}/${recordId}`);
    },
    [navigate, objectSlug],
  );

  // Toolbar: bridge addSort from DataTableToolbar's Omit<ViewSort,"id"> to viewState
  const handleAddSort = useCallback(
    (sort: Omit<ViewSort, "id">) => {
      viewState.addSort(sort.fieldId, sort.direction);
    },
    [viewState],
  );

  // Toolbar: bridge addFilter from DataTableToolbar's Omit<ViewFilter,"id"> to viewState
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

  // Handle ?create=true from sidebar quick-create
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

  // Document title
  useEffect(() => {
    if (obj) {
      document.title = `${obj.pluralName} | Basics CRM`;
    }
    return () => {
      document.title = "Basics CRM";
    };
  }, [obj]);

  // ----- Error states -----

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

  const IconComponent = getObjectIcon(obj.icon);
  const records = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-4">
      {/* ---- Page toolbar ---- */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={IconComponent} className="h-5 w-5 text-muted-foreground" />
          {total > 0 && (
            <span className="text-sm text-muted-foreground">{total} total</span>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          New {obj.singularName}
        </Button>
      </div>

      {/* ---- View selector tabs ---- */}
      {views.length > 0 && (
        <div className="shrink-0">
          <ViewSelector
            views={views}
            activeViewId={activeView?.id ?? ""}
            onSelectView={setActiveView}
            onCreateView={() =>
              createView.mutate({ title: `View ${views.length + 1}` })
            }
          />
        </div>
      )}

      {/* ---- Toolbar (sort / filter / actions) ---- */}
      {activeView && attributes.length > 0 && (
        <div className="shrink-0">
          <DataTableToolbar
          objectSlug={objectSlug}
          singularName={obj.singularName}
          sorts={viewState.sorts}
          filters={viewState.filters}
          attributes={attributes}
          viewColumns={viewState.columns}
          onToggleColumn={(columnId, show) =>
            viewState.updateColumn(columnId, { show })
          }
          onReorderColumn={(columnId, newOrder) =>
            viewState.updateColumn(columnId, { order: newOrder })
          }
          onAddSort={handleAddSort}
          onRemoveSort={viewState.removeSort}
          onUpdateSort={(sortId, updates) => {
            // Remove and re-add since viewState doesn't have updateSort
            viewState.removeSort(sortId);
            if (updates.fieldId && updates.direction) {
              viewState.addSort(updates.fieldId, updates.direction);
            }
          }}
          onAddFilter={handleAddFilter}
          onRemoveFilter={viewState.removeFilter}
          onUpdateFilter={(filterId, updates) => {
            viewState.removeFilter(filterId);
            if (updates.fieldId && updates.operator) {
              viewState.addFilter(
                updates.fieldId,
                updates.operator,
                updates.value,
                updates.logicalOp,
              );
            }
          }}
          onNewRecord={() => setCreateOpen(true)}
          isDirty={viewState.isDirty}
          onSave={viewState.save}
          onDiscard={viewState.discard}
        />
        </div>
      )}

      {/* ---- View save bar ---- */}
      <div className="shrink-0">
        <ViewSaveBar
          isDirty={viewState.isDirty}
          onSave={viewState.save}
          onDiscard={viewState.discard}
        />
      </div>

      {/* ---- Data table: only this area scrolls when columns/rows overflow ---- */}
      <div className="min-h-0 flex-1 overflow-auto">
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
        onRowDelete={handleRowDelete}
        onRowExpand={handleRowExpand}
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
      </div>

      {/* ---- Create record modal ---- */}
      <CreateRecordModal
        objectSlug={objectSlug}
        objectName={obj.singularName}
        attributes={attributes}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {/* ---- Create attribute modal (for adding new NocoDB columns) ---- */}
      <CreateAttributeModal
        objectSlug={objectSlug}
        resource={objectSlug}
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
      />
    </div>
  );
}
