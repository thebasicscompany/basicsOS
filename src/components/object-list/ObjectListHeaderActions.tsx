import { SortAscendingIcon, CaretDownIcon, FunnelIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    removeSort: (sortId: string) => void;
    addFilter: (
      fieldId: string,
      operator: string,
      value: unknown,
      logicalOp?: "and" | "or",
    ) => void;
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
  showTableActions = true,
}: ObjectListHeaderActionsProps) {
  const hasActiveSorts = viewState.sorts.length > 0;
  const hasActiveFilters = viewState.filters.length > 0;
  const actionsCount = viewState.sorts.length + viewState.filters.length;
  const columnVisibleCount = columnItems.filter((c) => c.vc.show).length;

  return (
    <>
      {showTableActions && attributes.length > 0 && (
        <TableActionsMenu
          actionsCount={actionsCount}
          attributes={attributes}
          sorts={viewState.sorts}
          filters={viewState.filters}
          hasActiveSorts={hasActiveSorts}
          hasActiveFilters={hasActiveFilters}
          onAddSort={onAddSort}
          onRemoveSort={viewState.removeSort}
          onAddFilter={onAddFilter}
          onRemoveFilter={viewState.removeFilter}
          onAddFilterRaw={viewState.addFilter}
          onAddSortRaw={viewState.addSort}
          columnItems={columnItems}
          onUpdateColumn={viewState.updateColumn}
          isDirty={viewState.isDirty}
          onDiscard={viewState.discard}
          onSave={viewState.save}
          columnVisibleCount={columnVisibleCount}
        />
      )}
      <Button size="sm" onClick={onCreateRecord} className="h-8 gap-1">
        <PlusIcon className="h-4 w-4" />
        New {singularName}
      </Button>
    </>
  );
}

function TableActionsMenu({
  actionsCount,
  attributes,
  sorts,
  filters,
  hasActiveSorts,
  hasActiveFilters,
  onAddSort,
  onRemoveSort,
  onAddFilter,
  onRemoveFilter,
  onAddFilterRaw,
  onAddSortRaw,
  columnItems,
  onUpdateColumn,
  isDirty,
  onDiscard,
  onSave,
  columnVisibleCount,
}: {
  actionsCount: number;
  attributes: Attribute[];
  sorts: ViewSort[];
  filters: ViewFilter[];
  hasActiveSorts: boolean;
  hasActiveFilters: boolean;
  onAddSort: (sort: Omit<ViewSort, "id">) => void;
  onRemoveSort: (sortId: string) => void;
  onAddFilter: (filter: Omit<ViewFilter, "id">) => void;
  onRemoveFilter: (filterId: string) => void;
  onAddFilterRaw: (
    fieldId: string,
    operator: string,
    value: unknown,
    logicalOp?: "and" | "or",
  ) => void;
  onAddSortRaw: (fieldId: string, direction: "asc" | "desc") => void;
  columnItems: ColumnItem[];
  onUpdateColumn: (
    columnId: string,
    updates: Partial<{ show?: boolean; order?: number; width?: string }>,
  ) => void;
  isDirty: boolean;
  onDiscard: () => void;
  onSave: () => Promise<void>;
  columnVisibleCount: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          Actions
          {actionsCount > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
              {actionsCount}
            </Badge>
          )}
          <CaretDownIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,420px)] p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
          <SortPopover
            attributes={attributes}
            sorts={sorts}
            onAdd={onAddSort}
            onRemove={onRemoveSort}
            onUpdate={(sortId, updates) => {
              onRemoveSort(sortId);
              if (updates.fieldId && updates.direction) {
                onAddSortRaw(updates.fieldId, updates.direction);
              }
            }}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full justify-between gap-1.5 text-xs sm:w-auto sm:justify-start"
            >
              <SortAscendingIcon className="size-3.5" />
              Sort
              {hasActiveSorts && (
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                  {sorts.length}
                </Badge>
              )}
            </Button>
          </SortPopover>
          <FilterPopover
            attributes={attributes}
            filters={filters}
            onAdd={onAddFilter}
            onRemove={onRemoveFilter}
            onUpdate={(filterId, updates) => {
              onRemoveFilter(filterId);
              if (updates.fieldId && updates.operator) {
                onAddFilterRaw(
                  updates.fieldId,
                  updates.operator,
                  updates.value,
                  updates.logicalOp,
                );
              }
            }}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full justify-between gap-1.5 text-xs sm:w-auto sm:justify-start"
            >
              <FunnelIcon className="size-3.5" />
              Filter
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                  {filters.length}
                </Badge>
              )}
            </Button>
          </FilterPopover>
          <ColumnsPopover
            items={columnItems}
            visibleCount={columnVisibleCount}
            totalCount={columnItems.length}
            onToggle={(columnId, show) => onUpdateColumn(columnId, { show })}
            onReorder={(columnId, newOrder) => onUpdateColumn(columnId, { order: newOrder })}
            triggerClassName="w-full justify-between sm:w-auto sm:justify-start"
          />
        </div>
        {isDirty && (
          <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onDiscard}
            >
              Discard changes
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={onSave}>
              Save for everyone
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
