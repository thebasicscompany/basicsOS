"use client";

import { useMemo } from "react";
import { Badge, Hash } from "@basicsos/ui";
import type { FieldDef } from "../CustomFieldsEditor";

/** Minimal column definition — kept in sync with CrmRecordTable.ColumnDef. */
export interface ColumnDef<T> {
  key: string;
  label: string;
  icon?: React.ElementType;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}

// ---------------------------------------------------------------------------
// Helpers for type-aware rendering
// ---------------------------------------------------------------------------

function formatDate(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "\u2014";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function renderTypedValue(value: unknown, def: FieldDef): React.ReactNode {
  if (value == null || value === "") {
    return <span className="text-muted-foreground">{"\u2014"}</span>;
  }

  switch (def.type) {
    case "boolean":
      return (
        <Badge variant={Boolean(value) ? "default" : "secondary"} className="text-[10px]">
          {Boolean(value) ? "Yes" : "No"}
        </Badge>
      );

    case "select":
      return (
        <Badge variant="outline" className="text-[10px] font-normal">
          {String(value)}
        </Badge>
      );

    case "multi_select": {
      const vals: string[] = Array.isArray(value) ? (value as string[]) : [String(value)];
      return (
        <div className="flex flex-wrap gap-1">
          {vals.map((v) => (
            <Badge key={v} variant="outline" className="text-[10px] font-normal">
              {v}
            </Badge>
          ))}
        </div>
      );
    }

    case "date":
      return <span className="text-sm">{formatDate(value)}</span>;

    case "number":
      return <span className="text-sm tabular-nums">{String(value)}</span>;

    case "url":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline-offset-2 hover:underline truncate max-w-[160px] inline-block"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );

    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Generates ColumnDef entries for custom fields.
 *
 * - When `fieldDefs` are provided the columns render values in a type-aware
 *   way (dates formatted, booleans as Yes/No badge, selects as Badge, etc.)
 *   and are ordered by field position.
 * - When `fieldDefs` is omitted it falls back to scanning all records for
 *   keys and renders raw string values (backwards-compatible behaviour).
 */
export function useCustomFieldColumns<
  T extends { customFields?: Record<string, unknown> | null },
>(records: T[], fieldDefs?: FieldDef[]): ColumnDef<T>[] {
  return useMemo(() => {
    // --- Typed mode: use field definitions ----------------------------------
    if (fieldDefs && fieldDefs.length > 0) {
      return fieldDefs.map(
        (def): ColumnDef<T> => ({
          key: `cf_${def.key}`,
          label: def.label,
          icon: Hash,
          sortable: def.type !== "multi_select",
          sortValue: (row: T) => {
            const val = row.customFields?.[def.key];
            if (def.type === "number") return Number(val ?? 0);
            if (def.type === "date") return typeof val === "string" ? val : "";
            if (def.type === "boolean") return Boolean(val) ? 1 : 0;
            return String(val ?? "").toLowerCase();
          },
          render: (row: T) => renderTypedValue(row.customFields?.[def.key], def),
        }),
      );
    }

    // --- Generic mode: discover keys from records --------------------------
    const keys = new Set<string>();
    for (const record of records) {
      if (record.customFields) {
        for (const key of Object.keys(record.customFields)) {
          keys.add(key);
        }
      }
    }

    return [...keys].sort().map(
      (key): ColumnDef<T> => ({
        key: `cf_${key}`,
        label: key,
        icon: Hash,
        sortable: true,
        sortValue: (row: T) =>
          String(row.customFields?.[key] ?? "").toLowerCase(),
        render: (row: T) => {
          const val = row.customFields?.[key];
          return val != null && val !== "" ? (
            <span className="text-sm">{String(val)}</span>
          ) : (
            <span className="text-muted-foreground">{"\u2014"}</span>
          );
        },
      }),
    );
  }, [records, fieldDefs]);
}
