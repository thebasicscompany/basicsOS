import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type {
  ViewConfig,
  ViewColumn,
  ViewSort,
  ViewFilter,
} from "@/types/views";

interface ViewRaw {
  id: string;
  title: string;
  type: number; // 3 = grid, 5 = form, 2 = kanban, 4 = gallery
  order: number;
  is_default: boolean;
  lock_type?: "collaborative" | "locked" | "personal";
}

interface ViewColumnRaw {
  id: string;
  fk_column_id: string;
  title: string;
  show: boolean;
  order: number;
  width?: string;
}

interface ViewSortRaw {
  id: string;
  fk_column_id: string;
  direction: "asc" | "desc";
  order: number;
}

interface ViewFilterRaw {
  id: string;
  fk_column_id: string;
  comparison_op: string;
  value: unknown;
  logical_op: "and" | "or";
}

const VIEW_TYPE_MAP: Record<number, ViewConfig["type"]> = {
  3: "grid",
  2: "kanban",
  4: "gallery",
  5: "form",
};

function mapView(raw: ViewRaw): ViewConfig {
  return {
    id: raw.id,
    title: raw.title,
    type: VIEW_TYPE_MAP[raw.type] ?? "grid",
    order: raw.order,
    isDefault: raw.is_default,
    lockType: raw.lock_type,
  };
}

function mapViewColumn(raw: ViewColumnRaw): ViewColumn {
  return {
    id: raw.id,
    fieldId: raw.fk_column_id,
    title: raw.title,
    show: raw.show,
    order: raw.order,
    width: raw.width,
  };
}

function mapViewSort(raw: ViewSortRaw): ViewSort {
  return {
    id: raw.id,
    fieldId: raw.fk_column_id,
    direction: raw.direction,
    order: raw.order,
  };
}

function mapViewFilter(raw: ViewFilterRaw): ViewFilter {
  return {
    id: raw.id,
    fieldId: raw.fk_column_id,
    operator: raw.comparison_op,
    value: raw.value,
    logicalOp: raw.logical_op,
  };
}

/**
 * List all views for an object (by CRM resource name).
 * GET /api/views/:objectSlug
 */
export function useViewList(resource: string) {
  return useQuery<ViewConfig[]>({
    queryKey: ["views", resource],
    queryFn: async () => {
      const response = await fetchApi<{ list: ViewRaw[] }>(
        `/api/views/${resource}`,
      );
      return response.list.map(mapView);
    },
    enabled: !!resource,
  });
}

/**
 * Get column configuration for a specific view.
 * GET /api/views/view/:viewId/columns
 */
export function useViewColumns(viewId: string) {
  return useQuery<ViewColumn[]>({
    queryKey: ["view-columns", viewId],
    queryFn: async () => {
      const response = await fetchApi<{ list: ViewColumnRaw[] }>(
        `/api/views/view/${viewId}/columns`,
      );
      return response.list.map(mapViewColumn);
    },
    enabled: !!viewId,
  });
}

/**
 * Create a new column in a view (for attributes that don't have a view column yet).
 * POST /api/views/view/:viewId/columns
 */
export function useCreateViewColumn(viewId: string) {
  const qc = useQueryClient();

  return useMutation<
    ViewColumn,
    Error,
    { fk_column_id: string; title?: string; show?: boolean; order?: number }
  >({
    mutationFn: async (body) => {
      const raw = await fetchApi<ViewColumnRaw>(
        `/api/views/view/${viewId}/columns`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      return mapViewColumn(raw);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["view-columns", viewId] });
    },
  });
}

/**
 * Update a column's visibility, order, or width within a view.
 * PATCH /api/views/view/:viewId/columns/:columnId
 */
export function useUpdateViewColumn(viewId: string) {
  const qc = useQueryClient();

  return useMutation<
    ViewColumn,
    Error,
    { columnId: string; show?: boolean; order?: number; width?: string; title?: string }
  >({
    mutationFn: async ({ columnId, ...updates }) => {
      const raw = await fetchApi<ViewColumnRaw>(
        `/api/views/view/${viewId}/columns/${columnId}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        },
      );
      return mapViewColumn(raw);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["view-columns", viewId] });
    },
  });
}

// ---------------------------------------------------------------------------
// View sorts
// ---------------------------------------------------------------------------

/**
 * List sorts for a view.
 * GET /api/views/view/:viewId/sorts
 */
export function useViewSorts(viewId: string) {
  return useQuery<ViewSort[]>({
    queryKey: ["view-sorts", viewId],
    queryFn: async () => {
      const response = await fetchApi<{ list: ViewSortRaw[] }>(
        `/api/views/view/${viewId}/sorts`,
      );
      return response.list.map(mapViewSort);
    },
    enabled: !!viewId,
  });
}

/**
 * Create a sort on a view.
 * POST /api/views/view/:viewId/sorts
 */
export function useCreateViewSort(viewId: string) {
  const qc = useQueryClient();

  return useMutation<
    ViewSort,
    Error,
    { fk_column_id: string; direction: "asc" | "desc" }
  >({
    mutationFn: async (body) => {
      const raw = await fetchApi<ViewSortRaw>(
        `/api/views/view/${viewId}/sorts`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      return mapViewSort(raw);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["view-sorts", viewId] });
    },
  });
}

/**
 * Delete a sort from a view.
 * DELETE /api/views/view/:viewId/sorts/:sortId
 */
export function useDeleteViewSort(viewId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (sortId) => {
      await fetchApi(`/api/views/view/${viewId}/sorts/${sortId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["view-sorts", viewId] });
    },
  });
}

/**
 * List filters for a view.
 * GET /api/views/view/:viewId/filters
 */
export function useViewFilters(viewId: string) {
  return useQuery<ViewFilter[]>({
    queryKey: ["view-filters", viewId],
    queryFn: async () => {
      const response = await fetchApi<{ list: ViewFilterRaw[] }>(
        `/api/views/view/${viewId}/filters`,
      );
      return response.list.map(mapViewFilter);
    },
    enabled: !!viewId,
  });
}

/**
 * Create a filter on a view.
 * POST /api/views/view/:viewId/filters
 */
export function useCreateViewFilter(viewId: string) {
  const qc = useQueryClient();

  return useMutation<
    ViewFilter,
    Error,
    {
      fk_column_id: string;
      comparison_op: string;
      value: unknown;
      logical_op?: "and" | "or";
    }
  >({
    mutationFn: async (body) => {
      const raw = await fetchApi<ViewFilterRaw>(
        `/api/views/view/${viewId}/filters`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      return mapViewFilter(raw);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["view-filters", viewId] });
    },
  });
}

/**
 * Delete a filter from a view.
 * DELETE /api/views/view/:viewId/filters/:filterId
 */
export function useDeleteViewFilter(viewId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (filterId) => {
      await fetchApi(`/api/views/view/${viewId}/filters/${filterId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["view-filters", viewId] });
    },
  });
}

/**
 * Rename a view.
 * PATCH /api/views/view/:viewId  body: { title }
 */
export function useRenameView(objectSlug: string) {
  const qc = useQueryClient();

  return useMutation<ViewConfig, Error, { viewId: string; title: string }>({
    mutationFn: async ({ viewId, title }) => {
      const raw = await fetchApi<ViewRaw>(`/api/views/view/${viewId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      return mapView(raw);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", objectSlug] });
    },
  });
}

/**
 * Delete a view.
 * DELETE /api/views/view/:viewId
 */
export function useDeleteView(objectSlug: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (viewId) => {
      await fetchApi(`/api/views/view/${viewId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", objectSlug] });
    },
  });
}
