"use client";

import { useMemo } from "react";
import { Hash, Calendar, Check, List, Phone, cn } from "@basicsos/ui";
import { Badge } from "@basicsos/ui";
import { trpc } from "@/lib/trpc";
import type { ColumnDef } from "../components/CrmRecordTable";
import { normalizeOptions, getOptionColor } from "../utils";

type Entity = "contacts" | "companies" | "deals";

/**
 * Queries customFieldDefs for the entity and generates type-aware ColumnDef entries.
 * Always shows all defined fields (even if no records have data yet).
 * onEdit(rowId, key, value) — called when user commits an inline edit.
 */
export function useCustomFieldColumns<
  T extends { customFields?: Record<string, unknown> | null },
>(entity: Entity, onEdit?: (rowId: string, key: string, value: unknown) => void): ColumnDef<T>[] {
  const { data: defs = [] } = trpc.crm.customFieldDefs.list.useQuery({ entity });

  return useMemo(() => {
    return defs.map((def): ColumnDef<T> => {
      const editType = ((): ColumnDef<T>["editType"] => {
        if (def.type === "number") return "number";
        if (def.type === "date") return "date";
        if (def.type === "boolean") return "boolean";
        if (def.type === "select") return "select";
        if (def.type === "multi_select") return "multi_select";
        return "text"; // covers text, url, phone
      })();

      const normalizedOpts = (def.type === "select" || def.type === "multi_select")
        ? normalizeOptions(def.options)
        : [];
      const editOptions = normalizedOpts.length > 0
        ? normalizedOpts.map((o) => ({ label: o.label, value: o.value, color: o.color }))
        : undefined;

      return {
        key: `cf_${def.id}`,
        label: def.label,
        icon: iconForType(def.type),
        sortable: true,
        sortValue: (row: T) =>
          String(row.customFields?.[def.key] ?? "").toLowerCase(),
        editValue: (row: T) => {
          const v = row.customFields?.[def.key];
          if (def.type === "boolean") return v === true || v === "true" ? "true" : "false";
          if (def.type === "date" && v) {
            const d = new Date(String(v));
            return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
          }
          if (def.type === "multi_select") {
            if (!v) return "";
            return Array.isArray(v) ? v.join(",") : String(v);
          }
          return v == null ? "" : String(v);
        },
        render: (row: T) => renderCustomField(row.customFields?.[def.key], def),
        editable: onEdit !== undefined,
        editType,
        editOptions,
        onEdit: onEdit
          ? (rowId: string, value: string) => {
              let coerced: unknown = value;
              if (def.type === "number") coerced = value === "" ? null : Number(value);
              if (def.type === "boolean") coerced = value === "true";
              if (def.type === "date") coerced = value === "" ? null : value;
              if (def.type === "select") coerced = value === "" ? null : value;
              if (def.type === "multi_select") coerced = value === "" ? [] : value.split(",").map((s) => s.trim()).filter(Boolean);
              // text, url, phone: coerced = value (string already)
              onEdit(rowId, def.key, coerced);
            }
          : undefined,
      };
    });
  }, [defs, onEdit]);
}

function iconForType(type: string): React.ElementType {
  switch (type) {
    case "number": return Hash;
    case "date": return Calendar;
    case "boolean": return Check;
    case "select":
    case "multi_select": return List;
    case "phone": return Phone;
    default: return Hash;
  }
}

function renderCustomField(
  val: unknown,
  def: { type: string; options?: unknown },
): React.ReactNode {
  if (val == null || val === "") {
    return <span className="text-muted-foreground">{"—"}</span>;
  }

  switch (def.type) {
    case "boolean":
      return val === true || val === "true" ? (
        <Badge variant="secondary" className="text-xs">Yes</Badge>
      ) : (
        <Badge variant="outline" className="text-xs">No</Badge>
      );

    case "select": {
      const opts = normalizeOptions(def.options);
      const opt = opts.find((o) => o.value === String(val) || o.label === String(val));
      const colors = opt ? getOptionColor(opt.color) : null;
      return (
        <div className="flex min-w-0 items-center gap-1.5">
          {colors && <span className={cn("size-2 shrink-0 rounded-full", colors.dot)} />}
          <Badge className={cn("text-xs border-0", colors?.badge ?? "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300")}>
            {opt?.label ?? String(val)}
          </Badge>
        </div>
      );
    }

    case "multi_select": {
      const opts = normalizeOptions(def.options);
      const values = Array.isArray(val) ? val : String(val).split(",").map((s) => s.trim());
      return (
        <div className="flex min-w-0 flex-wrap gap-1">
          {values.filter(Boolean).map((v) => {
            const opt = opts.find((o) => o.value === String(v) || o.label === String(v));
            const colors = opt ? getOptionColor(opt.color) : null;
            return (
              <div key={String(v)} className="flex items-center gap-1">
                {colors && <span className={cn("size-2 shrink-0 rounded-full", colors.dot)} />}
                <Badge className={cn("text-xs border-0", colors?.badge ?? "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300")}>
                  {opt?.label ?? String(v)}
                </Badge>
              </div>
            );
          })}
        </div>
      );
    }

    case "date": {
      const d = new Date(String(val));
      return !isNaN(d.getTime()) ? (
        <span className="text-xs text-muted-foreground">{d.toLocaleDateString()}</span>
      ) : (
        <span className="text-xs text-muted-foreground">{String(val)}</span>
      );
    }

    case "url":
      return (
        <a
          href={String(val)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(val)}
        </a>
      );

    case "phone":
      return (
        <a
          href={`tel:${String(val)}`}
          className="text-xs text-foreground hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(val)}
        </a>
      );

    default:
      return <span className="text-sm">{String(val)}</span>;
  }
}
