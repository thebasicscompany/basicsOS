"use client";

import { Badge, ChevronUp, ChevronDown, X } from "@basicsos/ui";

interface CrmSortChipProps {
  field: string;
  direction: "asc" | "desc";
  onToggle: () => void;
  onRemove: () => void;
}

export function CrmSortChip({ field, direction, onToggle, onRemove }: CrmSortChipProps): JSX.Element {
  const Arrow = direction === "asc" ? ChevronUp : ChevronDown;
  return (
    <Badge variant="secondary" className="inline-flex items-center gap-1 px-2 py-0.5 text-xs">
      <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 hover:text-foreground">
        <span className="capitalize font-medium">{field}</span>
        <Arrow className="size-3" />
      </button>
      <button type="button" onClick={onRemove} className="ml-0.5 hover:text-foreground">
        <X className="size-3" />
      </button>
    </Badge>
  );
}
