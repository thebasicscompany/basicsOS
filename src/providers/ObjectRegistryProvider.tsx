import { createContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { TAG_COLOR_PALETTE } from "@/field-types/colors";
import type { NocoDBColumn } from "@/hooks/use-nocodb-columns";
import type {
  Attribute,
  AttributeOverride,
  ObjectConfig,
  ObjectConfigApiResponse,
} from "@/types/objects";

// ---------------------------------------------------------------------------
// NocoDB uidt -> field type key mapping
// ---------------------------------------------------------------------------

const NOCODB_UIDT_TO_FIELD_TYPE: Record<string, string> = {
  SingleLineText: "text",
  LongText: "long-text",
  Number: "number",
  Currency: "currency",
  Checkbox: "checkbox",
  Date: "date",
  DateTime: "timestamp",
  Rating: "rating",
  SingleSelect: "select",
  MultiSelect: "multi-select",
  Email: "email",
  URL: "domain",
  JSON: "text",
  Decimal: "number",
  Percent: "number",
  Duration: "number",
  CreatedTime: "timestamp",
  LastModifiedTime: "timestamp",
  PhoneNumber: "phone",
  LinkToAnotherRecord: "relationship",
};

function mapNocoUidtToFieldType(uidt: string): string {
  return NOCODB_UIDT_TO_FIELD_TYPE[uidt] ?? "text";
}

// ---------------------------------------------------------------------------
// Merge NocoDB columns with attribute overrides into Attribute[]
// ---------------------------------------------------------------------------

/**
 * Parse NocoDB dtxp (comma-separated select values) into SelectOption[].
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
 * "CREATED_AT" → "Created At", "company_id" → "Company Id", "sales_id" → "Sales Id"
 */
function formatColumnName(col: NocoDBColumn): string {
  // col.title is usually human-friendly from NocoDB; prefer it if different
  if (col.title && col.title !== col.column_name) return col.title;
  // Format snake_case or UPPER_CASE column names
  if (/[_]/.test(col.column_name) || /^[A-Z_]+$/.test(col.column_name)) {
    return col.column_name
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return col.title || col.column_name;
}

function mergeAttributes(
  columns: NocoDBColumn[],
  overrides: AttributeOverride[],
): Attribute[] {
  const overrideByColumn = new Map<string, AttributeOverride>();
  for (const o of overrides) {
    overrideByColumn.set(o.columnName, o);
  }

  return columns.map((col) => {
    const override = overrideByColumn.get(col.column_name);
    const mappedUiType = mapNocoUidtToFieldType(col.uidt);

    // Parse dtxp into options for select/multi-select columns
    const isSelectType =
      col.uidt === "SingleSelect" || col.uidt === "MultiSelect";
    const dtxpOptions =
      isSelectType && col.dtxp ? parseDtxpOptions(col.dtxp) : undefined;

    return {
      id: col.id,
      name: override?.displayName ?? formatColumnName(col),
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
      isSystem: col.system,
      isHiddenByDefault: override?.isHiddenByDefault ?? col.system,
      icon: override?.icon,
      order: col.order,
    };
  });
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ObjectRegistryContextValue {
  objects: ObjectConfig[];
  getObject: (slug: string) => ObjectConfig | undefined;
  getAttributes: (slug: string) => Attribute[];
  isLoading: boolean;
  error: Error | null;
}

export const ObjectRegistryContext = createContext<ObjectRegistryContextValue>({
  objects: [],
  getObject: () => undefined,
  getAttributes: () => [],
  isLoading: true,
  error: null,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ObjectRegistryProvider({ children }: { children: ReactNode }) {
  // 1. Fetch object configs from backend API
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

  // 3. For each active object, fetch schema columns in parallel
  const columnQueries = useQueries({
    queries: activeConfigs.map((cfg) => ({
      queryKey: ["nocodb-columns", cfg.tableName],
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

  // 4. Determine loading / error states across all column queries
  const columnsLoading = columnQueries.some((q) => q.isLoading);
  const columnsError = columnQueries.find((q) => q.error)?.error ?? null;

  // 5. Build the column lookup: slug -> NocoDBColumn[]
  const columnsBySlug = useMemo(() => {
    const map = new Map<string, NocoDBColumn[]>();
    for (const q of columnQueries) {
      if (q.data) {
        map.set(q.data.slug, q.data.columns);
      }
    }
    return map;
  }, [columnQueries]);

  // 6. Merge everything into fully-resolved ObjectConfig[]
  const objects = useMemo<ObjectConfig[]>(() => {
    if (!activeConfigs.length) return [];

    return activeConfigs.map((cfg) => {
      const columns = columnsBySlug.get(cfg.slug) ?? [];
      const attributes = mergeAttributes(columns, cfg.attributes);

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

  // 7. Build lookup helpers
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
