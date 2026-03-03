import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type {
  ViewConfig,
  ViewColumn,
  ViewSort,
  ViewFilter,
} from "@/types/views";

// ---------------------------------------------------------------------------
// NocoDB raw response shapes
// ---------------------------------------------------------------------------

interface NocoViewRaw {
  id: string;
  title: string;
  type: number; // 3 = grid, 5 = form, 2 = kanban, 4 = gallery
  order: number;
  is_default: boolean;
  lock_type?: "collaborative" | "locked" | "personal";
}

interface NocoViewColumnRaw {
  id: string;
  fk_column_id: string;
  title: string;
  show: boolean;
  order: number;
  width?: string;
}

interface NocoViewSortRaw {
  id: string;
  fk_column_id: string;
  direction: "asc" | "desc";
  order: number;
}

interface NocoViewFilterRaw {
  id: string;
  fk_column_id: string;
  comparison_op: string;
  value: unknown;
  logical_op: "and" | "or";
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const VIEW_TYPE_MAP: Record<number, ViewConfig["type"]> = {
  3: "grid",
  2: "kanban",
  4: "gallery",
  5: "form",
};

function mapView(raw: NocoViewRaw): ViewConfig {
  return {
    id: raw.id,
    title: raw.title,
    type: VIEW_TYPE_MAP[raw.type] ?? "grid",
    order: raw.order,
    isDefault: raw.is_default,
    lockType: raw.lock_type,
  };
}

function mapViewColumn(raw: NocoViewColumnRaw): ViewColumn {
  return {
    id: raw.id,
    fieldId: raw.fk_column_id,
    title: raw.title,
    show: raw.show,
    order: raw.order,
    width: raw.width,
  };
}

function mapViewSort(raw: NocoViewSortRaw): ViewSort {
  return {
    id: raw.id,
    fieldId: raw.fk_column_id,
    direction: raw.direction,
    order: raw.order,
  };
}

function mapViewFilter(raw: NocoViewFilterRaw): ViewFilter {
  return {
    id: raw.id,
    fieldId: raw.fk_column_id,
    operator: raw.comparison_op,
    value: raw.value,
    logicalOp: raw.logical_op,
  };
}

// ---------------------------------------------------------------------------
// Views list
// ---------------------------------------------------------------------------

/**
 * List all views for an object (by CRM resource name).
 * GET /api/views/:objectSlug
 */
export function useNocoViews(resource: string) {
  return useQuery<ViewConfig[]>({
    queryKey: ["noco-views", resource],
    queryFn: async () => {
      const response = await fetchApi<{ list: NocoViewRaw[] }>(
        `/api/views/${resource}`,
      );
      return response.list.map(mapView);
    },
    enabled: !!resource,
  });
}

// ---------------------------------------------------------------------------
// View columns
// ---------------------------------------------------------------------------

/**
 * Get column configuration for a specific view.
 * GET /api/views/view/:viewId/columns
 */
export function useNocoViewColumns(viewId: string) {
  return useQuery<ViewColumn[]>({
    queryKey: ["noco-view-columns", viewId],
    queryFn: async () => {
      const response = await fetchApi<{ list: NocoViewColumnRaw[] }>(
        `/api/views/view/${viewId}/columns`,
      );
      return response.list.map(mapViewColumn);
    },
    enabled: !!viewId,
  });
}

/**
 * Update a column's visibility, order, or width within a view.
 * PATCH /api/views/view/:viewId/columns/:columnId
 */
export function useUpdateNocoViewColumn(viewId: string) {
  const qc = useQueryClient();

  return useMutation<
    ViewColumn,
    Error,
    { columnId: string; show?: boolean; order?: number; width?: string }
  >({
    mutationFn: async ({ columnId, ...updates }) => {
      const raw = await fetchApi<NocoViewColumnRaw>(
        `/api/views/view/${viewId}/columns/${columnId}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        },
      );
      return mapViewColumn(raw);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["noco-view-columns", viewId] });
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
export function useNocoViewSorts(viewId: string) {
  return useQuery<ViewSort[]>({
    queryKey: ["noco-view-sorts", viewId],
    queryFn: async () => {
      const response = await fetchApi<{ list: NocoViewSortRaw[] }>(
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
export function useCreateNocoViewSort(viewId: string) {
  const qc = useQueryClient();

  return useMutation<
    ViewSort,
    Error,
    { fk_column_id: string; direction: "asc" | "desc" }
  >({
    mutationFn: async (body) => {
      const raw = await fetchApi<NocoViewSortRaw>(
        `/api/views/view/${viewId}/sorts`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      return mapViewSort(raw);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["noco-view-sorts", viewId] });
    },
  });
}

/**
 * Delete a sort from a view.
 * DELETE /api/views/view/:viewId/sorts/:sortId
 */
export function useDeleteNocoViewSort(viewId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (sortId) => {
      await fetchApi(`/api/views/view/${viewId}/sorts/${sortId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["noco-view-sorts", viewId] });
    },
  });
}

// ---------------------------------------------------------------------------
// View filters
// ---------------------------------------------------------------------------

/**
 * List filters for a view.
 * GET /api/views/view/:viewId/filters
 */
export function useNocoViewFilters(viewId: string) {
  return useQuery<ViewFilter[]>({
    queryKey: ["noco-view-filters", viewId],
    queryFn: async () => {
      const response = await fetchApi<{ list: NocoViewFilterRaw[] }>(
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
export function useCreateNocoViewFilter(viewId: string) {
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
      const raw = await fetchApi<NocoViewFilterRaw>(
        `/api/views/view/${viewId}/filters`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      return mapViewFilter(raw);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["noco-view-filters", viewId] });
    },
  });
}

/**
 * Delete a filter from a view.
 * DELETE /api/views/view/:viewId/filters/:filterId
 */
export function useDeleteNocoViewFilter(viewId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (filterId) => {
      await fetchApi(`/api/views/view/${viewId}/filters/${filterId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["noco-view-filters", viewId] });
    },
  });
}
