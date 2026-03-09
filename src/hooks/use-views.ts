import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import {
  useViewList,
  useViewColumns,
  useViewSorts,
  useViewFilters,
  useUpdateViewColumn,
  useCreateViewColumn,
  useCreateViewSort,
  useDeleteViewSort,
  useCreateViewFilter,
  useDeleteViewFilter,
} from "@/hooks/use-view-queries";
import type {
  ViewConfig,
  ViewColumn,
  ViewSort,
  ViewFilter,
  ViewState,
} from "@/types/views";

interface CreateViewApiResponse {
  id: string;
  title: string;
  type: number;
  order: number;
  is_default: boolean;
}

interface UseViewsReturn {
  views: ViewConfig[];
  activeView: ViewConfig | undefined;
  setActiveView: (viewId: string) => void;
  createView: ReturnType<
    typeof useMutation<
      ViewConfig,
      Error,
      { title: string; type?: ViewConfig["type"] }
    >
  >;
  isLoading: boolean;
  error: Error | null;
}

const VIEW_TYPE_MAP: Record<number, ViewConfig["type"]> = {
  3: "grid",
  2: "kanban",
  4: "gallery",
  5: "form",
};

const VIEW_TYPE_TO_NOCO: Record<string, number> = {
  grid: 3,
  kanban: 2,
  gallery: 4,
  form: 5,
};

export function useViews(objectSlug: string): UseViewsReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: views = [], isLoading, error } = useViewList(objectSlug);

  const activeViewId = searchParams.get("view");

  const activeView = useMemo(() => {
    if (!views.length) return undefined;
    if (activeViewId) {
      const found = views.find((v) => v.id === activeViewId);
      if (found) return found;
    }
    return views.find((v) => v.isDefault) ?? views[0];
  }, [views, activeViewId]);

  const setActiveView = useCallback(
    (viewId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("view", viewId);
        return next;
      });
    },
    [setSearchParams],
  );

  const qc = useQueryClient();

  const createViewMutation = useMutation<
    ViewConfig,
    Error,
    { title: string; type?: ViewConfig["type"] }
  >({
    mutationFn: async ({ title, type = "grid" }) => {
      const raw = await fetchApi<CreateViewApiResponse>(
        `/api/views/${objectSlug}`,
        {
          method: "POST",
          body: JSON.stringify({
            title,
            type: VIEW_TYPE_TO_NOCO[type] ?? 3,
          }),
        },
      );
      return {
        id: raw.id,
        title: raw.title,
        type: VIEW_TYPE_MAP[raw.type] ?? "grid",
        order: raw.order,
        isDefault: raw.is_default,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", objectSlug] });
    },
  });

  return {
    views,
    activeView,
    setActiveView,
    createView: createViewMutation,
    isLoading,
    error: error as Error | null,
  };
}

type ViewStateAction =
  | { type: "SET_COLUMNS"; columns: ViewColumn[] }
  | { type: "SET_SORTS"; sorts: ViewSort[] }
  | { type: "SET_FILTERS"; filters: ViewFilter[] }
  | { type: "UPDATE_COLUMN"; columnId: string; updates: Partial<ViewColumn> }
  | { type: "UPSERT_COLUMN"; column: ViewColumn; replaceId?: string }
  | { type: "REMOVE_COLUMN"; columnId: string }
  | { type: "UPDATE_SORT"; sortId: string; updates: Partial<ViewSort> }
  | { type: "UPDATE_FILTER"; filterId: string; updates: Partial<ViewFilter> }
  | { type: "ADD_SORT"; sort: ViewSort }
  | { type: "REMOVE_SORT"; sortId: string }
  | { type: "ADD_FILTER"; filter: ViewFilter }
  | { type: "REMOVE_FILTER"; filterId: string }
  | { type: "MARK_CLEAN" }
  | { type: "DISCARD"; snapshot: ViewState };

function viewStateReducer(
  state: ViewState,
  action: ViewStateAction,
): ViewState {
  switch (action.type) {
    case "SET_COLUMNS":
      return { ...state, columns: action.columns };
    case "SET_SORTS":
      return { ...state, sorts: action.sorts };
    case "SET_FILTERS":
      return { ...state, filters: action.filters };
    case "UPDATE_COLUMN":
      return {
        ...state,
        isDirty: true,
        columns: state.columns.map((c) =>
          c.id === action.columnId ? { ...c, ...action.updates } : c,
        ),
      };
    case "UPSERT_COLUMN": {
      const columns = [...state.columns];
      const replaceIndex =
        action.replaceId != null
          ? columns.findIndex((column) => column.id === action.replaceId)
          : -1;
      if (replaceIndex !== -1) {
        columns[replaceIndex] = action.column;
      } else {
        const existingIndex = columns.findIndex(
          (column) =>
            column.id === action.column.id ||
            column.fieldId === action.column.fieldId,
        );
        if (existingIndex !== -1) {
          columns[existingIndex] = {
            ...columns[existingIndex],
            ...action.column,
          };
        } else {
          columns.push(action.column);
        }
      }
      return { ...state, isDirty: true, columns };
    }
    case "REMOVE_COLUMN":
      return {
        ...state,
        isDirty: true,
        columns: state.columns.filter(
          (column) => column.id !== action.columnId,
        ),
      };
    case "UPDATE_SORT":
      return {
        ...state,
        isDirty: true,
        sorts: state.sorts.map((sort) =>
          sort.id === action.sortId ? { ...sort, ...action.updates } : sort,
        ),
      };
    case "UPDATE_FILTER":
      return {
        ...state,
        isDirty: true,
        filters: state.filters.map((filter) =>
          filter.id === action.filterId
            ? { ...filter, ...action.updates }
            : filter,
        ),
      };
    case "ADD_SORT":
      return {
        ...state,
        isDirty: true,
        sorts: [...state.sorts, action.sort],
      };
    case "REMOVE_SORT":
      return {
        ...state,
        isDirty: true,
        sorts: state.sorts.filter((s) => s.id !== action.sortId),
      };
    case "ADD_FILTER":
      return {
        ...state,
        isDirty: true,
        filters: [...state.filters, action.filter],
      };
    case "REMOVE_FILTER":
      return {
        ...state,
        isDirty: true,
        filters: state.filters.filter((f) => f.id !== action.filterId),
      };
    case "MARK_CLEAN":
      return { ...state, isDirty: false };
    case "DISCARD":
      return { ...action.snapshot, isDirty: false };
    default:
      return state;
  }
}

interface UseViewStateReturn {
  columns: ViewColumn[];
  sorts: ViewSort[];
  filters: ViewFilter[];
  isDirty: boolean;
  isLoading: boolean;
  save: () => Promise<void>;
  discard: () => void;
  updateColumn: (
    columnId: string,
    updates: Partial<Pick<ViewColumn, "show" | "order" | "width" | "title">>,
  ) => void;
  addSort: (fieldId: string, direction: "asc" | "desc") => void;
  replaceSort: (fieldId: string, direction: "asc" | "desc") => void;
  updateSort: (sortId: string, updates: Partial<ViewSort>) => void;
  removeSort: (sortId: string) => void;
  addFilter: (
    fieldId: string,
    operator: string,
    value: unknown,
    logicalOp?: "and" | "or",
  ) => void;
  updateFilter: (filterId: string, updates: Partial<ViewFilter>) => void;
  removeFilter: (filterId: string) => void;
}

// shared refs to avoid effect churn
const EMPTY_COLUMNS: ViewColumn[] = [];
const EMPTY_SORTS: ViewSort[] = [];
const EMPTY_FILTERS: ViewFilter[] = [];

export function useViewState(viewId: string): UseViewStateReturn {
  const { data: serverColumns = EMPTY_COLUMNS, isLoading: columnsLoading } =
    useViewColumns(viewId);
  const { data: serverSorts = EMPTY_SORTS, isLoading: sortsLoading } =
    useViewSorts(viewId);
  const { data: serverFilters = EMPTY_FILTERS, isLoading: filtersLoading } =
    useViewFilters(viewId);

  const isLoading = columnsLoading || sortsLoading || filtersLoading;

  const [localState, dispatch] = useReducer(viewStateReducer, {
    columns: [],
    sorts: [],
    filters: [],
    isDirty: false,
  });

  const isDirtyRef = useRef(localState.isDirty);
  isDirtyRef.current = localState.isDirty;

  useEffect(() => {
    isDirtyRef.current = false;
    dispatch({
      type: "DISCARD",
      snapshot: {
        columns: [],
        sorts: [],
        filters: [],
        isDirty: false,
      },
    });
  }, [viewId]);

  useEffect(() => {
    if (!isDirtyRef.current) {
      dispatch({ type: "SET_COLUMNS", columns: serverColumns });
    }
  }, [serverColumns]);

  useEffect(() => {
    if (!isDirtyRef.current) {
      dispatch({ type: "SET_SORTS", sorts: serverSorts });
    }
  }, [serverSorts]);

  useEffect(() => {
    if (!isDirtyRef.current) {
      dispatch({ type: "SET_FILTERS", filters: serverFilters });
    }
  }, [serverFilters]);

  const updateColumnMutation = useUpdateViewColumn(viewId);
  const createColumnMutation = useCreateViewColumn(viewId);
  const createSortMutation = useCreateViewSort(viewId);
  const deleteSortMutation = useDeleteViewSort(viewId);
  const createFilterMutation = useCreateViewFilter(viewId);
  const deleteFilterMutation = useDeleteViewFilter(viewId);

  const updateColumn = useCallback(
    (
      columnId: string,
      updates: Partial<Pick<ViewColumn, "show" | "order" | "width" | "title">>,
    ) => {
      if (columnId.startsWith("virtual-") && updates.show === true) {
        const fieldId = columnId.replace(/^virtual-/, "");
        const optimisticColumn: ViewColumn = {
          id: `creating-${fieldId}`,
          fieldId,
          title: updates.title ?? "",
          show: true,
          order: updates.order ?? localState.columns.length,
          width: updates.width,
        };
        dispatch({ type: "UPSERT_COLUMN", column: optimisticColumn });
        void createColumnMutation
          .mutateAsync({
            fk_column_id: fieldId,
            show: true,
            order: optimisticColumn.order,
            title: optimisticColumn.title || undefined,
          })
          .then((createdColumn) => {
            dispatch({
              type: "UPSERT_COLUMN",
              column: {
                ...createdColumn,
                show: updates.show ?? createdColumn.show,
                width: updates.width ?? createdColumn.width,
              },
              replaceId: optimisticColumn.id,
            });
          })
          .catch(() => {
            dispatch({ type: "REMOVE_COLUMN", columnId: optimisticColumn.id });
          });
        return;
      }
      dispatch({ type: "UPDATE_COLUMN", columnId, updates });
      // Immediately persist title/order/width changes to the server (but not show — that goes through save/discard)
      const { show: _show, ...serverUpdates } = updates;
      if (
        serverUpdates.title !== undefined ||
        serverUpdates.order !== undefined ||
        serverUpdates.width !== undefined
      ) {
        void updateColumnMutation.mutateAsync({ columnId, ...serverUpdates });
      }
    },
    [createColumnMutation, updateColumnMutation, localState.columns.length],
  );

  const addSort = useCallback(
    (fieldId: string, direction: "asc" | "desc") => {
      // Optimistic: add a temporary sort with a placeholder ID
      const tempSort: ViewSort = {
        id: `temp-${Date.now()}`,
        fieldId,
        direction,
        order: localState.sorts.length,
      };
      dispatch({ type: "ADD_SORT", sort: tempSort });
    },
    [localState.sorts.length],
  );

  const replaceSort = useCallback(
    (fieldId: string, direction: "asc" | "desc") => {
      const tempSort: ViewSort = {
        id: `temp-${Date.now()}`,
        fieldId,
        direction,
        order: 0,
      };
      dispatch({ type: "SET_SORTS", sorts: [tempSort] });
      // Delete all existing server sorts, then create the new one
      const deletePromises = serverSorts.map((s) =>
        deleteSortMutation.mutateAsync(s.id),
      );
      void Promise.all(deletePromises).then(() =>
        createSortMutation.mutateAsync({
          fk_column_id: fieldId,
          direction,
        }),
      );
    },
    [serverSorts, deleteSortMutation, createSortMutation],
  );

  const removeSort = useCallback((sortId: string) => {
    dispatch({ type: "REMOVE_SORT", sortId });
  }, []);

  const updateSort = useCallback(
    (sortId: string, updates: Partial<ViewSort>) => {
      dispatch({ type: "UPDATE_SORT", sortId, updates });
    },
    [],
  );

  const addFilter = useCallback(
    (
      fieldId: string,
      operator: string,
      value: unknown,
      logicalOp: "and" | "or" = "and",
    ) => {
      const tempFilter: ViewFilter = {
        id: `temp-${Date.now()}`,
        fieldId,
        operator,
        value,
        logicalOp,
      };
      dispatch({ type: "ADD_FILTER", filter: tempFilter });
    },
    [],
  );

  const removeFilter = useCallback((filterId: string) => {
    dispatch({ type: "REMOVE_FILTER", filterId });
  }, []);

  const updateFilter = useCallback(
    (filterId: string, updates: Partial<ViewFilter>) => {
      dispatch({ type: "UPDATE_FILTER", filterId, updates });
    },
    [],
  );

  const save = useCallback(async () => {
    const columnPromises = localState.columns.map((col) => {
      const serverCol = serverColumns.find((s) => s.id === col.id);
      if (!serverCol) return Promise.resolve();
      const hasChanges =
        serverCol.show !== col.show ||
        serverCol.order !== col.order ||
        serverCol.width !== col.width;
      if (!hasChanges) return Promise.resolve();

      return updateColumnMutation.mutateAsync({
        columnId: col.id,
        show: col.show,
        order: col.order,
        width: col.width,
      });
    });

    const sortDeletePromises = serverSorts.map((sort) =>
      deleteSortMutation.mutateAsync(sort.id),
    );
    const filterDeletePromises = serverFilters.map((filter) =>
      deleteFilterMutation.mutateAsync(filter.id),
    );

    await Promise.all([
      ...columnPromises,
      ...sortDeletePromises,
      ...filterDeletePromises,
    ]);

    const sortCreatePromises = localState.sorts
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((sort) =>
        createSortMutation.mutateAsync({
          fk_column_id: sort.fieldId,
          direction: sort.direction,
        }),
      );

    const filterCreatePromises = localState.filters.map((filter) =>
      createFilterMutation.mutateAsync({
        fk_column_id: filter.fieldId,
        comparison_op: filter.operator,
        value: filter.value,
        logical_op: filter.logicalOp,
      }),
    );

    await Promise.all([...sortCreatePromises, ...filterCreatePromises]);
    dispatch({ type: "MARK_CLEAN" });
  }, [
    localState,
    serverColumns,
    serverSorts,
    serverFilters,
    updateColumnMutation,
    createSortMutation,
    deleteSortMutation,
    createFilterMutation,
    deleteFilterMutation,
  ]);

  // Discard — revert to server state
  const discard = useCallback(() => {
    dispatch({
      type: "DISCARD",
      snapshot: {
        columns: serverColumns,
        sorts: serverSorts,
        filters: serverFilters,
        isDirty: false,
      },
    });
  }, [serverColumns, serverSorts, serverFilters]);

  return {
    columns: localState.columns,
    sorts: localState.sorts,
    filters: localState.filters,
    isDirty: localState.isDirty,
    isLoading,
    save,
    discard,
    updateColumn,
    addSort,
    replaceSort,
    updateSort,
    removeSort,
    addFilter,
    updateFilter,
    removeFilter,
  };
}
