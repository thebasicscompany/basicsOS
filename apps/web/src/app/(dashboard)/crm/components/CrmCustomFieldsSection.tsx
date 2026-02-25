"use client";

import { trpc } from "@/lib/trpc";
import { Badge, ExternalLink, Phone, cn } from "@basicsos/ui";
import { normalizeOptions, getOptionColor } from "../utils";

interface CrmCustomFieldsSectionProps {
  entity: "contacts" | "companies" | "deals";
  customFields: Record<string, unknown>;
}

function formatValue(
  type: string,
  value: unknown,
  rawOptions: unknown,
): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (type === "boolean") {
    return (
      <Badge variant={value ? "default" : "secondary"} className="text-xs">
        {value ? "Yes" : "No"}
      </Badge>
    );
  }

  if (type === "select") {
    const opts = normalizeOptions(rawOptions);
    const opt = opts.find((o) => o.value === String(value) || o.label === String(value));
    const colors = opt ? getOptionColor(opt.color) : null;
    return (
      <div className="flex items-center gap-1.5">
        {colors && <span className={cn("size-2 rounded-full", colors.dot)} />}
        <Badge className={cn("text-xs border-0", colors?.badge ?? "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300")}>
          {opt?.label ?? String(value)}
        </Badge>
      </div>
    );
  }

  if (type === "multi_select") {
    const opts = normalizeOptions(rawOptions);
    const vals = Array.isArray(value) ? (value as string[]) : [String(value)];
    if (vals.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {vals.map((v) => {
          const opt = opts.find((o) => o.value === String(v) || o.label === String(v));
          const colors = opt ? getOptionColor(opt.color) : null;
          return (
            <div key={v} className="flex items-center gap-1">
              {colors && <span className={cn("size-2 rounded-full", colors.dot)} />}
              <Badge className={cn("text-xs border-0", colors?.badge ?? "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300")}>
                {opt?.label ?? v}
              </Badge>
            </div>
          );
        })}
      </div>
    );
  }

  if (type === "date") {
    return (
      <span className="text-sm text-foreground">
        {new Date(String(value)).toLocaleDateString()}
      </span>
    );
  }

  if (type === "url") {
    const href = String(value);
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-sm text-primary hover:underline"
      >
        {href.replace(/^https?:\/\//, "").slice(0, 30)}
        <ExternalLink size={12} />
      </a>
    );
  }

  if (type === "phone") {
    const tel = String(value);
    return (
      <a
        href={`tel:${tel}`}
        className="flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <Phone size={12} />
        {tel}
      </a>
    );
  }

  return <span className="text-sm text-foreground">{String(value)}</span>;
}

export function CrmCustomFieldsSection({
  entity,
  customFields,
}: CrmCustomFieldsSectionProps): JSX.Element | null {
  const { data: defs = [] } = trpc.crm.customFieldDefs.list.useQuery({ entity });

  if (defs.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-stone-200 dark:border-stone-700">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Custom Fields
      </p>
      <div className="flex flex-col gap-2">
        {defs.map((def) => (
          <div key={def.key} className="flex items-start gap-2 text-sm">
            <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
              {def.label}
            </span>
            <div className="flex-1 min-w-0">
              {formatValue(
                def.type,
                customFields[def.key],
                def.options,
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
