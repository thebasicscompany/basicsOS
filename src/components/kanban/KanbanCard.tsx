import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Attribute } from "./KanbanBoard";

// ---------------------------------------------------------------------------
// KanbanField -- renders a single field value on a card
// ---------------------------------------------------------------------------

/**
 * A lightweight field renderer for kanban cards.
 *
 * When the field-types registry (`@/field-types/registry`) and the
 * `KanbanField` cell component (`@/components/cells`) are available from
 * other phases, this can delegate to them. For now it provides sensible
 * defaults for common NocoDB UI types so the kanban is immediately usable.
 */
function KanbanFieldDisplay({
  attribute,
  value,
}: {
  attribute: Attribute;
  value: any;
}) {
  if (value == null || value === "") return null;

  // Format based on uiType / sqlType
  const uiType = attribute.uiType ?? attribute.sqlType ?? "";

  switch (uiType.toLowerCase()) {
    case "currency":
    case "number": {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num))
        return <span className="truncate">{String(value)}</span>;
      if (uiType.toLowerCase() === "currency") {
        return (
          <span className="truncate tabular-nums">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: attribute.config?.currencyCode ?? "USD",
              maximumFractionDigits: 0,
            }).format(num)}
          </span>
        );
      }
      return (
        <span className="truncate tabular-nums">
          {new Intl.NumberFormat("en-US").format(num)}
        </span>
      );
    }

    case "percent": {
      const pct = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(pct))
        return <span className="truncate">{String(value)}</span>;
      return <span className="truncate tabular-nums">{pct}%</span>;
    }

    case "date":
    case "datetime":
    case "createtime":
    case "lastmodifiedtime": {
      try {
        const d = new Date(value);
        return (
          <span className="truncate tabular-nums">
            {d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year:
                d.getFullYear() !== new Date().getFullYear()
                  ? "numeric"
                  : undefined,
            })}
          </span>
        );
      } catch {
        return <span className="truncate">{String(value)}</span>;
      }
    }

    case "checkbox": {
      const checked = value === true || value === 1 || value === "true";
      return <span>{checked ? "Yes" : "No"}</span>;
    }

    case "email":
      return <span className="truncate text-primary">{String(value)}</span>;

    case "url":
    case "phonenumber":
      return <span className="truncate">{String(value)}</span>;

    case "singleselect":
    case "multiselect":
    case "status":
    case "select": {
      if (Array.isArray(value)) {
        return <span className="truncate">{value.join(", ")}</span>;
      }
      return <span className="truncate">{String(value)}</span>;
    }

    case "rating": {
      const rating = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(rating)) return null;
      const maxStars = attribute.config?.max ?? 5;
      return (
        <span className="truncate">
          {"*".repeat(Math.min(rating, maxStars))}
          {"*".repeat(Math.max(0, maxStars - rating)).replace(/\*/g, " ")}
        </span>
      );
    }

    default:
      return <span className="truncate">{String(value)}</span>;
  }
}

// ---------------------------------------------------------------------------
// KanbanCard
// ---------------------------------------------------------------------------

export interface KanbanCardProps {
  record: Record<string, any>;
  attributes: Attribute[];
  primaryAttribute: Attribute;
  displayAttributes: Attribute[];
  onUpdate: (columnName: string, value: any) => void;
  onClick?: () => void;
  isDragging?: boolean;
}

export const KanbanCard = memo(function KanbanCard({
  record,
  primaryAttribute,
  displayAttributes,
  onClick,
  isDragging,
}: KanbanCardProps) {
  const primaryValue = record[primaryAttribute.columnName] ?? "Untitled";

  // Only show display attributes that have values
  const visibleFields = useMemo(() => {
    return displayAttributes
      .filter((attr) => {
        const val = record[attr.columnName];
        return val != null && val !== "";
      })
      .slice(0, 4); // Cap at 4 fields for card readability
  }, [displayAttributes, record]);

  return (
    <Card
      className={cn(
        "cursor-grab gap-0 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-all duration-150",
        "hover:shadow-md",
        "active:cursor-grabbing",
        isDragging && [
          "cursor-grabbing shadow-lg ring-2 ring-primary/20",
          "rotate-[2deg] scale-[1.02]",
        ],
      )}
      onClick={(e) => {
        // Don't trigger click during drag
        if (isDragging) return;
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* Primary field (title) */}
      <p className="truncate text-sm font-medium leading-snug">
        {String(primaryValue)}
      </p>

      {/* Display attributes */}
      {visibleFields.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1">
          {visibleFields.map((attr) => (
            <div
              key={attr.id}
              className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
            >
              {attr.icon && (
                <span className="shrink-0" aria-hidden>
                  {attr.icon}
                </span>
              )}
              <span className="shrink-0 font-medium">{attr.name}:</span>
              <KanbanFieldDisplay
                attribute={attr}
                value={record[attr.columnName]}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
});
