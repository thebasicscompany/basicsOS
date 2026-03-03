import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

/**
 * Column definition returned by the schema API (NocoDB-shaped for compatibility).
 */
export interface NocoDBColumn {
  id: string;
  fk_model_id: string;
  title: string;
  column_name: string;
  uidt: string;
  dt: string;
  np: number | null;
  ns: number | null;
  clen: number | null;
  cop: string;
  pk: boolean;
  pv: boolean;
  rqd: boolean;
  un: boolean;
  ai: boolean;
  unique: boolean;
  cdf: string | null;
  cc: string;
  csn: string;
  dtx: string;
  dtxp: string;
  dtxs: string;
  au: boolean;
  order: number;
  system: boolean;
  meta: Record<string, unknown> | null;
}

/** Map CRM field types to NocoDB uidt values */
const FIELD_TYPE_TO_UIDT: Record<string, string> = {
  text: "SingleLineText",
  "long-text": "LongText",
  number: "Number",
  currency: "Currency",
  select: "SingleSelect",
  "multi-select": "MultiSelect",
  status: "SingleSelect",
  checkbox: "Checkbox",
  date: "Date",
  timestamp: "DateTime",
  rating: "Rating",
  email: "Email",
  domain: "URL",
  phone: "PhoneNumber",
  location: "SingleLineText",
  user: "SingleLineText",
  relationship: "LinkToAnotherRecord",
  boolean: "Checkbox",
  url: "URL",
  longText: "LongText",
};

interface CustomFieldDef {
  id: number;
  resource: string;
  name: string;
  label: string;
  fieldType: string;
  options: string[] | null;
}

/**
 * Fetch all columns for a resource (schema + custom fields).
 * GET /api/schema/:tableName
 */
export function useTableColumns(resource: string) {
  return useQuery<NocoDBColumn[]>({
    queryKey: ["nocodb-columns", resource],
    queryFn: async () => {
      const response = await fetchApi<{ columns: NocoDBColumn[] }>(
        `/api/schema/${resource}`,
      );
      return response.columns;
    },
    enabled: !!resource,
  });
}

/**
 * Create a custom field (stored in custom_field_defs).
 * POST /api/custom_field_defs
 */
export function useCreateColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      resource: string;
      title: string;
      fieldType: string;
      options?: Array<{ id: string; label: string; color: string }> | string[];
    }) => {
      const safeName = params.title.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const row = await fetchApi<CustomFieldDef>("/api/custom_field_defs", {
        method: "POST",
        body: JSON.stringify({
          resource: params.resource,
          name: safeName,
          label: params.title,
          fieldType: params.fieldType,
          options: params.options?.map((o) =>
            typeof o === "string" ? o : o.label,
          ),
        }),
      });
      const uidt = FIELD_TYPE_TO_UIDT[params.fieldType] ?? "SingleLineText";
      return {
        id: `custom_${row.id}`,
        fk_model_id: params.resource,
        title: row.label,
        column_name: row.name,
        uidt,
        dt: "varchar",
        np: null,
        ns: null,
        clen: null,
        cop: "",
        pk: false,
        pv: false,
        rqd: false,
        un: false,
        ai: false,
        unique: false,
        cdf: null,
        cc: "",
        csn: "",
        dtx: "",
        dtxp: Array.isArray(row.options) ? row.options.join(",") : "",
        dtxs: "",
        au: false,
        order: 999,
        system: false,
        meta: null,
      } as NocoDBColumn;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["nocodb-columns", vars.resource] });
      qc.invalidateQueries({ queryKey: ["object-config"] });
    },
  });
}

/**
 * Delete a custom field.
 * DELETE /api/custom_field_defs/:id (columnId is "custom_42" or numeric string)
 */
export function useDeleteColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { columnId: string; resource: string }) => {
      const id =
        params.columnId.startsWith("custom_")
          ? params.columnId.slice(7)
          : params.columnId;
      await fetchApi(`/api/custom_field_defs/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["nocodb-columns", vars.resource] });
    },
  });
}
