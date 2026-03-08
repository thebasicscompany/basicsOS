import {
  SortAscendingIcon,
  FunnelIcon,
  PlusIcon,
  ArrowsClockwiseIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SortPopover,
  FilterPopover,
  ColumnsPopover,
} from "@/components/data-table";
import type { ViewSort, ViewFilter } from "@/types/views";
import type { ColumnItem } from "@/components/data-table";
import type { Attribute } from "@/field-types/types";

export interface ObjectListHeaderActionsProps {
  singularName: string;
  attributes: Attribute[];
  columnItems: ColumnItem[];
  viewState: {
    sorts: ViewSort[];
    filters: ViewFilter[];
    isDirty: boolean;
    addSort: (fieldId: string, direction: "asc" | "desc") => void;
    updateSort: (sortId: string, updates: Partial<ViewSort>) => void;
    removeSort: (sortId: string) => void;
    addFilter: (
      fieldId: string,
      operator: string,
      value: unknown,
      logicalOp?: "and" | "or",
    ) => void;
    updateFilter: (filterId: string, updates: Partial<ViewFilter>) => void;
    removeFilter: (filterId: string) => void;
    updateColumn: (
      columnId: string,
      updates: Partial<{ show?: boolean; order?: number; width?: string }>,
    ) => void;
    discard: () => void;
    save: () => Promise<void>;
  };
  onAddSort: (sort: Omit<ViewSort, "id">) => void;
  onAddFilter: (filter: Omit<ViewFilter, "id">) => void;
  onCreateRecord: () => void;
  onAddColumn?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showTableActions?: boolean;
}

export function ObjectListHeaderActions({
  singularName,
  attributes,
  columnItems,
  viewState,
  onAddSort,
  onAddFilter,
  onCreateRecord,
  onAddColumn,
  onRefresh,
  isRefreshing,
  showTableActions = true,
}: ObjectListHeaderActionsProps) {
  const hasActiveSorts = viewState.sorts.length > 0;
  const hasActiveFilters = viewState.filters.length > 0;
  const columnVisibleCount = columnItems.filter((c) => c.vc.show).length;

  return (
    <>
      {showTableActions && attributes.length > 0 && (
        <div className="flex items-center gap-2">
          <SortPopover
            attributes={attributes}
            sorts={viewState.sorts}
            onAdd={onAddSort}
            onRemove={viewState.removeSort}
            onUpdate={viewState.updateSort}
          >
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <SortAscendingIcon className="size-3.5" />
              Sort
              {hasActiveSorts && (
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-4 min-w-4 px-1 text-[10px]"
                >
                  {viewState.sorts.length}
                </Badge>
              )}
            </Button>
          </SortPopover>
          <FilterPopover
            attributes={attributes}
            filters={viewState.filters}
            onAdd={onAddFilter}
            onRemove={viewState.removeFilter}
            onUpdate={viewState.updateFilter}
          >
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <FunnelIcon className="size-3.5" />
              Filter
              {hasActiveFilters && (
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-4 min-w-4 px-1 text-[10px]"
                >
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
            onAddColumn={onAddColumn}
          />
          {viewState.isDirty && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border border-blue-400/30 px-3 py-1.5 animate-in fade-in slide-in-from-right-2">
              <div className="size-2 shrink-0 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                Unsaved changes
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={viewState.discard}
              >
                Discard
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                onClick={viewState.save}
              >
                Save for everyone
              </Button>
            </div>
          )}
        </div>
      )}
      {onRefresh && (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh to see updates"
        >
          <ArrowsClockwiseIcon
            className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>
      )}
      <Button size="sm" onClick={onCreateRecord} className="h-8 gap-1">
        <PlusIcon className="h-4 w-4" />
        New {singularName}
      </Button>
    </>
  );
}
