"use client";

import { useMemo } from "react";
import { Hash } from "@basicsos/ui";
import type { ColumnDef } from "../components/CrmRecordTable";

/**
 * Scans all records for custom field keys and generates ColumnDef entries
 * that can be appended to the standard columns array.
 */
export function useCustomFieldColumns<
  T extends { customFields?: Record<string, unknown> | null },
>(records: T[]): ColumnDef<T>[] {
  return useMemo(() => {
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
  }, [records]);
}
