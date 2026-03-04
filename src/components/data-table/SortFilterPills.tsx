import { FunnelIcon, SortAscendingIcon, XIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ViewFilter, ViewSort } from "@/types/views";

export interface SortFilterPillsProps {
  sorts: ViewSort[];
  filters: ViewFilter[];
  getAttributeName: (fieldId: string) => string;
  onRemoveSort: (sortId: string) => void;
  onRemoveFilter: (filterId: string) => void;
  className?: string;
}

export function SortFilterPills({
  sorts,
  filters,
  getAttributeName,
  onRemoveSort,
  onRemoveFilter,
  className,
}: SortFilterPillsProps) {
  const hasActiveSorts = sorts.length > 0;
  const hasActiveFilters = filters.length > 0;

  if (!hasActiveSorts && !hasActiveFilters) return null;

  return (
    <div className={className ?? "flex flex-wrap items-center gap-1.5"}>
      {sorts.map((sort) => {
        const attrName = getAttributeName(sort.fieldId);
        return (
          <Badge
            key={sort.id}
            variant="outline"
            className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal"
          >
            <SortAscendingIcon className="size-3 text-muted-foreground" />
            <span className="max-w-32 truncate">{attrName}</span>
            <span className="text-muted-foreground">
              {sort.direction === "asc" ? "A-Z" : "Z-A"}
            </span>
            <button
              type="button"
              className="ml-0.5 rounded-sm p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              onClick={() => onRemoveSort(sort.id)}
              aria-label={`Remove sort: ${attrName}`}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        );
      })}

      {hasActiveSorts && hasActiveFilters && (
        <Separator orientation="vertical" className="h-4" />
      )}

      {filters.map((filter, idx) => {
        const attrName = getAttributeName(filter.fieldId);
        const valueLabel =
          filter.value !== undefined &&
          filter.value !== null &&
          String(filter.value) !== ""
            ? String(filter.value)
            : null;

        return (
          <Badge
            key={filter.id}
            variant="outline"
            className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal"
          >
            {idx > 0 && (
              <span className="mr-0.5 text-muted-foreground">{filter.logicalOp}</span>
            )}
            <FunnelIcon className="size-3 text-muted-foreground" />
            <span className="max-w-28 truncate">{attrName}</span>
            <span className="text-muted-foreground">{filter.operator}</span>
            {valueLabel && <span className="max-w-36 truncate font-medium">{valueLabel}</span>}
            <button
              type="button"
              className="ml-0.5 rounded-sm p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              onClick={() => onRemoveFilter(filter.id)}
              aria-label={`Remove filter: ${attrName}`}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        );
      })}
    </div>
  );
}
