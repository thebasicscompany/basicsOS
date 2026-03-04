import { SortFilterPills } from "@/components/data-table/SortFilterPills";
import type { ViewSort, ViewFilter } from "@/types/views";
import type { Attribute } from "@/field-types/types";

export interface ObjectListSortFilterPillsProps {
  sorts: ViewSort[];
  filters: ViewFilter[];
  attrMap: Map<string, Attribute>;
  onRemoveSort: (sortId: string) => void;
  onRemoveFilter: (filterId: string) => void;
}

export function ObjectListSortFilterPills({
  sorts,
  filters,
  attrMap,
  onRemoveSort,
  onRemoveFilter,
}: ObjectListSortFilterPillsProps) {
  return (
    <SortFilterPills
      sorts={sorts}
      filters={filters}
      getAttributeName={(fieldId) => attrMap.get(fieldId)?.name ?? fieldId}
      onRemoveSort={onRemoveSort}
      onRemoveFilter={onRemoveFilter}
      className="flex shrink-0 flex-wrap items-center gap-1.5"
    />
  );
}
