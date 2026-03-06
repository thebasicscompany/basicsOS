import { SortFilterPills } from "@/components/data-table/SortFilterPills";
import type { ViewSort, ViewFilter } from "@/types/views";
import type { Attribute } from "@/field-types/types";
import { getAttributeDisplayName, isNameFieldId } from "@/lib/crm/display-name";

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
      getAttributeName={(fieldId) => {
        const allAttrs = Array.from(attrMap.values());
        const attr = attrMap.get(fieldId);
        if (isNameFieldId(fieldId, allAttrs)) {
          return getAttributeDisplayName(attr, allAttrs, true);
        }
        return getAttributeDisplayName(attr, allAttrs) || fieldId;
      }}
      onRemoveSort={onRemoveSort}
      onRemoveFilter={onRemoveFilter}
      className="flex shrink-0 flex-wrap items-center gap-1.5"
    />
  );
}
