import { useMemo, type ReactNode } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { TAG_COLOR_PALETTE } from "@/field-types/colors";
import type { SchemaColumn } from "@/hooks/use-columns";
import type {
  Attribute,
  AttributeOverride,
  ObjectConfig,
  ObjectConfigApiResponse,
} from "@/types/objects";

import { mapUidtToFieldType } from "@/field-types";
import {
  ObjectRegistryContext,
  type ObjectRegistryContextValue,
} from "./object-registry-context";

/**
 * Parse dtxp (comma-separated select values) into SelectOption[].
 * e.g. "opportunity,proposal-sent,won,lost" → [{id, label, color}, ...]
 */
function parseDtxpOptions(
  dtxp: string,
): Array<{ id: string; label: string; color: string }> {
  if (!dtxp) return [];
  return dtxp
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((value, i) => ({
      id: value,
      label: value
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      color: TAG_COLOR_PALETTE[i % TAG_COLOR_PALETTE.length].name,
    }));
}

/**
 * Format column names to human-readable form.
 * "CREATED_AT" → "Created At", "company_id" → "Company Id", "crm_user_id" → "Crm User Id"
 */
function formatColumnName(col: NocoDBColumn): string {
  // prefer col.title when it differs (human-friendly)
  if (col.title && col.title !== col.column_name) return col.title;
  // snake_case / UPPER_CASE -> readable
  if (/[_]/.test(col.column_name) || /^[A-Z_]+$/.test(col.column_name)) {
    return col.column_name
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return col.title || col.column_name;
}

function mergeAttributes(
  columns: SchemaColumn[],
  overrides: AttributeOverride[],
  slug: string,
): Attribute[] {
  const overrideByColumn = new Map<string, AttributeOverride>();
  for (const o of overrides) {
    overrideByColumn.set(o.columnName, o);
  }

  return columns.map((col) => {
    const override = overrideByColumn.get(col.column_name);
    let mappedUiType = mapUidtToFieldType(col.uidt);
    let displayName = override?.displayName ?? formatColumnName(col);

    // Deals & contacts: show company picker (searchable companies) instead of company ID number
    if (
      (slug === "deals" || slug === "contacts") &&
      col.column_name === "company_id"
    ) {
      mappedUiType = "company";
      displayName = "Company";
    }

    // dtxp -> select options
    const isSelectType =
      col.uidt === "SingleSelect" || col.uidt === "MultiSelect";
    const dtxpOptions =
      isSelectType && col.dtxp ? parseDtxpOptions(col.dtxp) : undefined;

    return {
      id: col.id,
      name: displayName,
      columnName: col.column_name,
      uiType: override?.uiType ?? mappedUiType,
      sqlType: col.uidt,
      config: {
        ...(col.dtxp ? { dtxp: col.dtxp } : {}),
        ...(dtxpOptions ? { options: dtxpOptions } : {}),
        ...(col.meta ?? {}),
        ...(override?.config ?? {}),
      },
      isPrimary: override?.isPrimary ?? col.pv,
      isRequired: (col as SchemaColumn).rqd ?? false,
      isSystem: col.system,
      isHiddenByDefault: override?.isHiddenByDefault ?? col.system,
      icon: override?.icon,
      order: col.order,
    };
  });
}

export function ObjectRegistryProvider({ children }: { children: ReactNode }) {
  const {
    data: rawConfigs,
    isLoading: configsLoading,
    error: configsError,
  } = useQuery<ObjectConfigApiResponse[]>({
    queryKey: ["object-config"],
    queryFn: () => fetchApi<ObjectConfigApiResponse[]>("/api/object-config"),
  });

  // 2. Filter to active objects
  const activeConfigs = useMemo(() => {
    if (!rawConfigs) return [];
    return rawConfigs.filter((cfg) => cfg.isActive);
  }, [rawConfigs]);

  const columnQueries = useQueries({
    queries: activeConfigs.map((cfg) => ({
      queryKey: ["columns", cfg.tableName],
      queryFn: async (): Promise<{
        slug: string;
        columns: NocoDBColumn[];
      }> => {
        const response = await fetchApi<{ columns: NocoDBColumn[] }>(
          `/api/schema/${cfg.tableName}`,
        );
        return { slug: cfg.slug, columns: response.columns };
      },
      enabled: !!cfg.tableName,
    })),
  });

  const columnsLoading = columnQueries.some((q) => q.isLoading);
  const columnsError = columnQueries.find((q) => q.error)?.error ?? null;

  const columnsBySlug = useMemo(() => {
    const map = new Map<string, NocoDBColumn[]>();
    for (const q of columnQueries) {
      if (q.data) {
        map.set(q.data.slug, q.data.columns);
      }
    }
    return map;
  }, [columnQueries]);

  const objects = useMemo<ObjectConfig[]>(() => {
    if (!activeConfigs.length) return [];

    return activeConfigs.map((cfg) => {
      const columns = columnsBySlug.get(cfg.slug) ?? [];
      const attributes = mergeAttributes(columns, cfg.attributes, cfg.slug);

      return {
        id: cfg.id,
        slug: cfg.slug,
        singularName: cfg.singularName,
        pluralName: cfg.pluralName,
        icon: cfg.icon,
        iconColor: cfg.iconColor,
        tableName: cfg.tableName,
        type: cfg.type as "standard" | "system",
        isActive: cfg.isActive,
        position: cfg.position,
        settings: cfg.settings as Record<string, unknown>,
        attributes,
      };
    });
  }, [activeConfigs, columnsBySlug]);

  const contextValue = useMemo<ObjectRegistryContextValue>(() => {
    const objectMap = new Map<string, ObjectConfig>();
    for (const obj of objects) {
      objectMap.set(obj.slug, obj);
    }

    return {
      objects,
      getObject: (slug: string) => objectMap.get(slug),
      getAttributes: (slug: string) => objectMap.get(slug)?.attributes ?? [],
      isLoading: configsLoading || columnsLoading,
      error: (configsError as Error | null) ?? (columnsError as Error | null),
    };
  }, [objects, configsLoading, columnsLoading, configsError, columnsError]);

  return (
    <ObjectRegistryContext.Provider value={contextValue}>
      {children}
    </ObjectRegistryContext.Provider>
  );
}
