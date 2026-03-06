import type { CellDisplayProps } from "@/field-types/types";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const URL_REGEX = /^https?:\/\/.+/i;

export function TextCellDisplay({
  value,
  attribute,
  isSelected,
}: CellDisplayProps) {
  if (value == null || value === "") {
    return (
      <span className="text-muted-foreground truncate text-sm">
        {isSelected ? "" : ""}
      </span>
    );
  }

  const display =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  if (URL_REGEX.test(display)) {
    return (
      <a
        href={display}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 truncate text-sm text-blue-600 hover:underline dark:text-blue-400"
        onClick={(e) => e.stopPropagation()}
        title={display}
      >
        {display}
        <ArrowSquareOutIcon className="h-3 w-3 shrink-0 opacity-60" />
      </a>
    );
  }

  return (
    <span
      className={cn("truncate text-sm", attribute.isPrimary && "font-medium")}
      title={display}
    >
      {display}
    </span>
  );
}
