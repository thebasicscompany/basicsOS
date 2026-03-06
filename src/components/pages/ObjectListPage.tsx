import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { DataTable, buildColumnItems } from "@/components/data-table";
import { CreateRecordModal } from "@/components/create-record/CreateRecordModal";
import { CreateAttributeModal } from "@/components/create-attribute/CreateAttributeModal";
import { EditAttributeDialog } from "@/components/create-attribute/EditAttributeDialog";
import { RecordDetailDeleteDialog } from "@/components/record-detail";
import {
  DealsLayoutToggle,
  ObjectListHeaderActions,
  ObjectListSortFilterPills,
  ObjectListViewTabs,
} from "@/components/object-list";
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
  const [editAttrFieldId, setEditAttrFieldId] = useState<string | null>(null);
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
      } catch { /* ignore */ }
    }
    return "table" as const;
  })();
  const setLayout = useCallback(
    (newLayout: "table" | "kanban") => {
      try {
        localStorage.setItem(layoutKey, newLayout);
      } catch { /* ignore */ }
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
        op: attr ? normalizeFilterOperator(f.operator || "eq", attr) : f.operator || "eq",
        value: attr ? normalizeFilterValue(f.operator || "eq", f.value, attr) : String(f.value ?? ""),
        logicalOp: f.logicalOp,
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
      const attribute = attributes.find((attr) => attr.columnName === columnName);
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
        />
      </>
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
    isDeals,
    setLayout,
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
              onNewRecord={() => setCreateOpen(true)}
              onAddColumn={() => setAddColumnOpen(true)}
              onColumnResize={(fieldId, width) => {
                const vc = viewState.columns.find((c) => c.fieldId === fieldId);
                if (vc) viewState.updateColumn(vc.id, { width: String(width) });
              }}
              onSwapColumns={(fieldIdA, fieldIdB) => {
                const vcA = viewState.columns.find((c) => c.fieldId === fieldIdA);
                const vcB = viewState.columns.find((c) => c.fieldId === fieldIdB);
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

        <EditAttributeDialog
          attribute={
            editAttrFieldId
              ? attributes.find((a) => a.id === editAttrFieldId) ?? null
              : null
          }
          objectSlug={objectSlug}
          open={editAttrFieldId != null}
          onOpenChange={(open) => !open && setEditAttrFieldId(null)}
        />
      </div>
    </>
  );
}
