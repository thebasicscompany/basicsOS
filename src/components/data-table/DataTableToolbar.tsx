import { SortAscendingIcon, ColumnsIcon, FunnelIcon, DotsThreeVerticalIcon } from "@phosphor-icons/react"
import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getFieldType } from "@/field-types";
import type { Attribute } from "@/field-types/types";
import type { ViewSort, ViewFilter, ViewColumn } from "@/types/views";
import { cn } from "@/lib/utils";
import { SortPopover } from "./SortPopover";
import { FilterPopover } from "./FilterPopover";
import { SortFilterPills } from "./SortFilterPills";

export interface DataTableToolbarProps {
  objectSlug: string;
  singularName: string;
  sorts: ViewSort[];
  filters: ViewFilter[];
  attributes: Attribute[];
  viewColumns?: ViewColumn[];
  onToggleColumn?: (columnId: string, show: boolean) => void;
  onReorderColumn?: (columnId: string, newOrder: number) => void;
  onAddSort: (sort: Omit<ViewSort, "id">) => void;
  onRemoveSort: (sortId: string) => void;
  onUpdateSort?: (sortId: string, updates: Partial<ViewSort>) => void;
  onAddFilter: (filter: Omit<ViewFilter, "id">) => void;
  onRemoveFilter: (filterId: string) => void;
  onUpdateFilter?: (filterId: string, updates: Partial<ViewFilter>) => void;
  onNewRecord?: () => void;
  isDirty?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  selectedCount?: number;
  onBulkDelete?: () => void;
}

export function DataTableToolbar({
  objectSlug,
  singularName,
  sorts,
  filters,
  attributes,
  viewColumns,
  onToggleColumn,
  onReorderColumn,
  onAddSort,
  onRemoveSort,
  onUpdateSort,
  onAddFilter,
  onRemoveFilter,
  onUpdateFilter,
  onNewRecord,
  isDirty = false,
  onSave,
  onDiscard,
  selectedCount = 0,
  onBulkDelete,
}: DataTableToolbarProps) {
  const hasActiveSorts = sorts.length > 0;
  const hasActiveFilters = filters.length > 0;

  // Build a name map for display
  const attrMap = React.useMemo(
    () => new Map(attributes.map((a) => [a.id, a])),
    [attributes],
  );

  const columnItems = React.useMemo(
    () => buildColumnItems(viewColumns, attributes),
    [viewColumns, attributes],
  );

  const visibleCount = columnItems.filter((c) => c.vc.show).length;

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: Toolbar buttons */}
      <div className="flex items-center gap-2">
        {/* Sort button */}
        <SortPopover
          attributes={attributes}
          sorts={sorts}
          onAdd={onAddSort}
          onRemove={onRemoveSort}
          onUpdate={onUpdateSort}
        >
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <SortAscendingIcon className="size-3.5" />
            Sort
            {hasActiveSorts && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px]"
              >
                {sorts.length}
              </Badge>
            )}
          </Button>
        </SortPopover>

        {/* Filter button */}
        <FilterPopover
          attributes={attributes}
          filters={filters}
          onAdd={onAddFilter}
          onRemove={onRemoveFilter}
          onUpdate={onUpdateFilter}
        >
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <FunnelIcon className="size-3.5" />
            Filter
            {hasActiveFilters && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px]"
              >
                {filters.length}
              </Badge>
            )}
          </Button>
        </FilterPopover>

        {/* Columns visibility + reorder */}
        {viewColumns && onToggleColumn && (
          <ColumnsPopover
            items={columnItems}
            visibleCount={visibleCount}
            totalCount={columnItems.length}
            onToggle={onToggleColumn}
            onReorder={onReorderColumn}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Dirty state actions */}
        {isDirty && onSave && onDiscard && (
          <div className="flex items-center gap-2">
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

      </div>

      {/* Row 2: Active sort/filter pills */}
      {(hasActiveSorts || hasActiveFilters) && (
        <SortFilterPills
          sorts={sorts}
          filters={filters}
          getAttributeName={(fieldId) => attrMap.get(fieldId)?.name ?? fieldId}
          onRemoveSort={onRemoveSort}
          onRemoveFilter={onRemoveFilter}
          className="flex flex-wrap items-center gap-1.5"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Columns Popover — full attribute list with drag-to-reorder and toggles
// ---------------------------------------------------------------------------

export interface ColumnItem {
  vc: ViewColumn;
  attr: Attribute;
}

export function buildColumnItems(
  viewColumns: ViewColumn[] | undefined,
  attributes: Attribute[],
): ColumnItem[] {
  if (!viewColumns?.length) return [];
  const attrMap = new Map(attributes.map((a) => [a.id, a]));
  const vcMap = new Map(viewColumns.map((vc) => [vc.fieldId, vc]));
  const matched: ColumnItem[] = [];
  const sortedVcs = [...viewColumns].sort((a, b) => a.order - b.order);
  for (const vc of sortedVcs) {
    const attr = attrMap.get(vc.fieldId);
    if (attr) matched.push({ vc, attr });
  }
  for (const attr of attributes) {
    if (!vcMap.has(attr.id)) {
      matched.push({
        vc: {
          id: `virtual-${attr.id}`,
          fieldId: attr.id,
          title: attr.name,
          show: false,
          order: matched.length,
        },
        attr,
      });
    }
  }
  return matched;
}

export function ColumnsPopover({
  items,
  visibleCount,
  totalCount,
  onToggle,
  onReorder,
  triggerClassName,
}: {
  items: ColumnItem[];
  visibleCount: number;
  totalCount: number;
  onToggle: (columnId: string, show: boolean) => void;
  onReorder?: (columnId: string, newOrder: number) => void;
  triggerClassName?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor),
  );

  const itemIds = React.useMemo(() => items.map((i) => i.vc.id), [items]);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onReorder) return;

      const oldIndex = itemIds.indexOf(String(active.id));
      const newIndex = itemIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      // Reorder: update every affected item's order
      const reordered = arrayMove(items, oldIndex, newIndex);
      reordered.forEach((item, idx) => {
        if (item.vc.order !== idx) {
          onReorder(item.vc.id, idx);
        }
      });
    },
    [items, itemIds, onReorder],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-7 gap-1.5 text-xs", triggerClassName)}
        >
          <ColumnsIcon className="size-3.5" />
          Columns
          <Badge
            variant="secondary"
            className="ml-0.5 h-4 min-w-4 px-1 text-[10px]"
          >
            {visibleCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="px-3 py-2 border-b">
          <p className="text-xs font-medium text-muted-foreground">
            {visibleCount} of {totalCount} columns visible
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={itemIds}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <SortableColumnRow
                  key={item.vc.id}
                  item={item}
                  onToggle={onToggle}
                  canDrag={!!onReorder}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortableColumnRow({
  item,
  onToggle,
  canDrag,
}: {
  item: ColumnItem;
  onToggle: (columnId: string, show: boolean) => void;
  canDrag: boolean;
}) {
  const {
    attributes: dndAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.vc.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const fieldType = getFieldType(item.attr.uiType);
  const FieldIcon = fieldType.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1 mx-1 rounded-sm hover:bg-accent/50",
        isDragging && "z-50 bg-background shadow-sm",
      )}
    >
      {canDrag && (
        <button
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0"
          {...dndAttributes}
          {...listeners}
        >
          <DotsThreeVerticalIcon className="size-3" />
        </button>
      )}
      <span className="text-muted-foreground shrink-0">
        <FieldIcon className="size-3.5" />
      </span>
      <span className="text-sm truncate flex-1">{item.attr.name}</span>
      <Switch
        checked={item.vc.show}
        onCheckedChange={(checked) => onToggle(item.vc.id, checked)}
        className="scale-75"
      />
    </div>
  );
}
