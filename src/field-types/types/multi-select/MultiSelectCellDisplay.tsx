import type { CellDisplayProps, SelectOption } from "@/field-types/types";
import { getColorClasses, getColorByHash } from "@/field-types/colors";
import { cn } from "@/lib/utils";

export function MultiSelectCellDisplay({ value, config }: CellDisplayProps) {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-muted-foreground text-sm" />;
  }

  const items: string[] = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const options: SelectOption[] = config.options ?? [];

  if (items.length === 0) {
    return <span className="text-muted-foreground text-sm" />;
  }

  return (
    <div className="flex flex-wrap items-start gap-1">
      {items.map((item, i) => {
        const option = options.find((o) => o.id === item || o.label === item);
        const colorName = option?.color ?? getColorByHash(String(item)).name;
        const colors = getColorClasses(colorName);
        const label = option?.label ?? String(item);

        return (
          <span
            key={`${item}-${i}`}
            className={cn(
              "inline-flex min-w-0 max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium break-words whitespace-normal",
              colors.bg,
              colors.text,
              colors.border,
            )}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
