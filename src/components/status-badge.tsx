import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getColorClasses, getColorByHash } from "@/field-types/colors";

function toLabel(value: string): string {
  return value
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getBadgeStyle(colorName?: string): string {
  if (colorName) {
    const colors = getColorClasses(colorName);
    return `${colors.bg} ${colors.text} ${colors.border}`;
  }
  return "border-zinc-200/60 text-zinc-500 dark:border-zinc-700/60 dark:text-zinc-400";
}

export interface SelectBadgeProps {
  value: string | null;
  options?: Array<{
    id?: string;
    label?: string;
    color?: string;
  }>;
}

export function SelectBadge({ value, options = [] }: SelectBadgeProps) {
  if (!value) return null;

  const option = options.find((o) => o.id === value || o.label === value);
  const label = option?.label ?? toLabel(value);
  const colorName = option?.color ?? getColorByHash(value).name;

  return (
    <Badge
      variant="outline"
      className={cn("h-5 text-[11px] font-normal", getBadgeStyle(colorName))}
    >
      {label}
    </Badge>
  );
}

export function ContactStatusBadge({ status }: { status: string | null }) {
  return <SelectBadge value={status} />;
}

export interface DealStageBadgeProps {
  stage: string | null;
  options?: Array<{ id?: string; label?: string; color?: string }>;
}

export function DealStageBadge({ stage, options = [] }: DealStageBadgeProps) {
  return <SelectBadge value={stage} options={options} />;
}
