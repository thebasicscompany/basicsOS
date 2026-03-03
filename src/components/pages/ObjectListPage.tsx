import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { ArrowUpDown, ChevronDown, Filter, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DataTable,
  ViewSelector,
  SortPopover,
  FilterPopover,
  ColumnsPopover,
  buildColumnItems,
} from "@/components/data-table";
import { CreateRecordModal } from "@/components/create-record/CreateRecordModal";
import { CreateAttributeModal } from "@/components/create-attribute/CreateAttributeModal";
import { useObject, useAttributes } from "@/hooks/use-object-registry";
import { useRecords, useUpdateRecord, useDeleteRecord } from "@/hooks/use-records";
import { useViews, useViewState } from "@/hooks/use-views";
import type { ViewSort, ViewFilter } from "@/types/views";
import { usePageTitle, usePageHeaderActions } from "@/contexts/page-header";
import { Separator } from "@/components/ui/separator";

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
    [viewState.addSort],
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
    [viewState.addFilter],
  );

  const columnItems = useMemo(
    () => buildColumnItems(viewState.columns, attributes),
    [viewState.columns, attributes],
  );
  const columnVisibleCount = columnItems.filter((c) => c.vc.show).length;
  const attrMap = useMemo(
    () => new Map(attributes.map((a) => [a.id, a])),
    [attributes],
  );

  const headerActionsNode = useMemo(() => {
    if (!obj) return null;
    const hasActiveSorts = viewState.sorts.length > 0;
    const hasActiveFilters = viewState.filters.length > 0;
    const actionsCount = viewState.sorts.length + viewState.filters.length;

    return (
      <>
        {activeView && attributes.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                Actions
                {actionsCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                    {actionsCount}
                  </Badge>
                )}
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-[280px] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <SortPopover
                  attributes={attributes}
                  sorts={viewState.sorts}
                  onAdd={handleAddSort}
                  onRemove={viewState.removeSort}
                  onUpdate={(sortId, updates) => {
                    viewState.removeSort(sortId);
                    if (updates.fieldId && updates.direction) {
                      viewState.addSort(updates.fieldId, updates.direction);
                    }
                  }}
                >
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                    <ArrowUpDown className="size-3.5" />
                    Sort
                    {hasActiveSorts && (
                      <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                        {viewState.sorts.length}
                      </Badge>
                    )}
                  </Button>
                </SortPopover>
                <FilterPopover
                  attributes={attributes}
                  filters={viewState.filters}
                  onAdd={handleAddFilter}
                  onRemove={viewState.removeFilter}
                  onUpdate={(filterId, updates) => {
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
                >
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                    <Filter className="size-3.5" />
                    Filter
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                        {viewState.filters.length}
                      </Badge>
                    )}
                  </Button>
                </FilterPopover>
                <ColumnsPopover
                  items={columnItems}
                  visibleCount={columnVisibleCount}
                  totalCount={columnItems.length}
                  onToggle={(columnId, show) => viewState.updateColumn(columnId, { show })}
                  onReorder={(columnId, newOrder) =>
                    viewState.updateColumn(columnId, { order: newOrder })
                  }
                />
                {viewState.isDirty && (
                  <>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={viewState.discard}
                    >
                      Discard changes
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={viewState.save}>
                      Save for everyone
                    </Button>
                  </>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button size="sm" onClick={() => setCreateOpen(true)} className="h-8 gap-1">
          <Plus className="h-4 w-4" />
          New {obj.singularName}
        </Button>
      </>
    );
  }, [
    obj,
    activeView,
    attributes,
    viewState.sorts,
    viewState.filters,
    viewState.isDirty,
    viewState.removeSort,
    viewState.removeFilter,
    viewState.updateColumn,
    viewState.discard,
    viewState.save,
    columnItems,
    columnVisibleCount,
    handleAddSort,
    handleAddFilter,
  ]);

  const headerActionsPortal = usePageHeaderActions(headerActionsNode);

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

  const records = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasActiveSorts = viewState.sorts.length > 0;
  const hasActiveFilters = viewState.filters.length > 0;

  return (
    <>
    {headerActionsPortal}
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-4">
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

      {/* ---- Active sort/filter pills ---- */}
      {activeView && attributes.length > 0 && (hasActiveSorts || hasActiveFilters) && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {viewState.sorts.map((sort) => {
            const attr = attrMap.get(sort.fieldId);
            return (
              <Badge
                key={sort.id}
                variant="outline"
                className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal"
              >
                <ArrowUpDown className="size-3 text-muted-foreground" />
                <span>{attr?.name ?? sort.fieldId}</span>
                <span className="text-muted-foreground">
                  {sort.direction === "asc" ? "A-Z" : "Z-A"}
                </span>
                <button
                  type="button"
                  className="ml-0.5 rounded-sm p-0.5 hover:bg-muted"
                  onClick={() => viewState.removeSort(sort.id)}
                  aria-label="Remove sort"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
          {hasActiveSorts && hasActiveFilters && (
            <Separator orientation="vertical" className="h-4" />
          )}
          {viewState.filters.map((filter, idx) => {
            const attr = attrMap.get(filter.fieldId);
            return (
              <Badge
                key={filter.id}
                variant="outline"
                className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal"
              >
                {idx > 0 && (
                  <span className="mr-0.5 text-muted-foreground">
                    {filter.logicalOp}
                  </span>
                )}
                <Filter className="size-3 text-muted-foreground" />
                <span>{attr?.name ?? filter.fieldId}</span>
                <span className="text-muted-foreground">{filter.operator}</span>
                {filter.value !== undefined &&
                  filter.value !== null &&
                  String(filter.value) !== "" && (
                    <span className="font-medium">{String(filter.value)}</span>
                  )}
                <button
                  type="button"
                  className="ml-0.5 rounded-sm p-0.5 hover:bg-muted"
                  onClick={() => viewState.removeFilter(filter.id)}
                  aria-label="Remove filter"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* ---- Data table: fills remaining height; only table body scrolls ---- */}
      <div className="flex min-h-0 flex-1 flex-col">
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
    </>
  );
}
