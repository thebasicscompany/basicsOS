import type { CellDisplayProps } from "@/field-types/types";

export function CompanyCellDisplay({ value }: CellDisplayProps) {
  if (value == null || value === "") {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  return (
    <span className="block w-full truncate text-sm">
      {typeof value === "object" && value !== null && "name" in value
        ? String((value as { name: string }).name)
        : String(value)}
    </span>
  );
}
