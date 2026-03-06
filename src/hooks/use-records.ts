import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as crmApi from "@/lib/api/crm";
import type { FilterDef } from "@/lib/api/crm";

export interface RecordSortParam {
  field: string;
  order: "ASC" | "DESC";
}

export interface UseRecordsParams {
  page?: number;
  perPage?: number;
  sort?: RecordSortParam | RecordSortParam[];
  filter?: Record<string, unknown>;
  /** View-level filters (generic filters sent to API) */
  viewFilters?: FilterDef[];
  /** Legacy: NocoDB-style where clause (parsed when viewFilters not set) */
  extraWhere?: string;
}

interface RecordListResult<T> {
  data: T[];
  total: number;
}

/**
 * Fetch a paginated, sorted, filtered list of records for a given object.
 *
 * Query key: `["records", objectSlug, params]`
 */
export function useRecords<T = Record<string, unknown>>(
  objectSlug: string,
  params?: UseRecordsParams,
) {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 25;

  return useQuery<RecordListResult<T>>({
    queryKey: [
      "records",
      objectSlug,
      {
        page,
        perPage,
        sort: params?.sort,
        filter: params?.filter,
        viewFilters: params?.viewFilters,
        extraWhere: params?.extraWhere,
      },
    ],
    queryFn: () =>
      crmApi.getList<T>(objectSlug, {
        pagination: { page, perPage },
        sort: params?.sort,
        filter: params?.filter,
        viewFilters: params?.viewFilters,
        extraWhere: params?.extraWhere,
      }),
    enabled: !!objectSlug,
  });
}

/**
 * Fetch a single record by ID.
 *
 * Query key: `["records", objectSlug, "detail", recordId]`
 */
export function useRecord<T = Record<string, unknown>>(
  objectSlug: string,
  recordId: number | string,
) {
  return useQuery<T>({
    queryKey: ["records", objectSlug, "detail", recordId],
    queryFn: () => crmApi.getOne<T>(objectSlug, recordId),
    enabled: !!objectSlug && recordId != null,
  });
}

/**
 * Create a new record for the given object.
 * Invalidates the list query on success.
 */
export function useCreateRecord<T = Record<string, unknown>>(
  objectSlug: string,
) {
  const qc = useQueryClient();

  return useMutation<T, Error, Record<string, unknown>>({
    mutationFn: (data) => crmApi.create<T>(objectSlug, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["records", objectSlug] });
    },
  });
}

/**
 * Update an existing record by ID.
 * Invalidates both the list query and the specific record detail query.
 */
export function useUpdateRecord<T = Record<string, unknown>>(
  objectSlug: string,
) {
  const qc = useQueryClient();

  return useMutation<
    T,
    Error,
    { id: number | string; data: Record<string, unknown> }
  >({
    mutationFn: ({ id, data }) => crmApi.update<T>(objectSlug, id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ["records", objectSlug] });

      const applyPatch = (record: Record<string, unknown>) => {
        const next = { ...record };
        for (const [key, value] of Object.entries(data)) {
          if (key === "customFields" && value && typeof value === "object") {
            next.customFields = {
              ...(next.customFields as Record<string, unknown> | undefined),
              ...(value as Record<string, unknown>),
            };
            continue;
          }
          next[key] = value;
        }
        return next;
      };

      qc.setQueriesData({ queryKey: ["records", objectSlug] }, (current) => {
        if (!current || typeof current !== "object") return current;

        if ("data" in current && Array.isArray((current as RecordListResult<Record<string, unknown>>).data)) {
          const typed = current as RecordListResult<Record<string, unknown>>;
          return {
            ...typed,
            data: typed.data.map((record) =>
              ((record as { id?: number | string; Id?: number | string }).id === id ||
                (record as { id?: number | string; Id?: number | string }).Id === id)
                ? applyPatch(record as Record<string, unknown>)
                : record,
            ),
          };
        }

        if (
          "id" in (current as Record<string, unknown>) ||
          "Id" in (current as Record<string, unknown>)
        ) {
          const record = current as Record<string, unknown>;
          if (record.id === id || record.Id === id) {
            return applyPatch(record);
          }
        }

        return current;
      });
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["records", objectSlug] });
      qc.invalidateQueries({
        queryKey: ["records", objectSlug, "detail", variables.id],
      });
    },
  });
}

/**
 * Delete a record by ID.
 * Invalidates the list query on success.
 */
export function useDeleteRecord<T = Record<string, unknown>>(
  objectSlug: string,
) {
  const qc = useQueryClient();

  return useMutation<T, Error, number | string>({
    mutationFn: (id) => crmApi.remove<T>(objectSlug, id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["records", objectSlug] });
      qc.removeQueries({
        queryKey: ["records", objectSlug, "detail", id],
      });
    },
  });
}
