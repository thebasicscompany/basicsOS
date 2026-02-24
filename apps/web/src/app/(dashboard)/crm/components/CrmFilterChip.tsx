"use client";

import { Badge, X } from "@basicsos/ui";

interface CrmFilterChipProps {
  field: string;
  value: string;
  operator: string;
  onRemove: () => void;
}

export function CrmFilterChip({ field, value, operator, onRemove }: CrmFilterChipProps): JSX.Element {
  const displayOp = operator === "is" ? ":" : operator === "contains" ? "~" : operator;
  return (
    <Badge variant="secondary" className="inline-flex items-center gap-1 px-2 py-0.5 text-xs">
      <span className="capitalize text-muted-foreground">{field}</span>
      <span className="text-muted-foreground">{displayOp}</span>
      <span className="font-medium">{value}</span>
      <button type="button" onClick={onRemove} className="ml-0.5 hover:text-foreground">
        <X className="size-3" />
      </button>
    </Badge>
  );
}
