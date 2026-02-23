"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export interface CrmFilter {
  field: string;
  operator: "is" | "contains" | "gt" | "lt";
  value: string;
}

export interface CrmViewState {
  search: string;
  sort: string;
  sortDir: "asc" | "desc";
  filters: CrmFilter[];
  viewType: "table" | "kanban";
  hiddenColumns: Set<string>;
  setSearch: (v: string) => void;
  setSort: (field: string) => void;
  toggleSortDir: () => void;
  addFilter: (filter: CrmFilter) => void;
  removeFilter: (field: string) => void;
  clearFilters: () => void;
  setViewType: (v: "table" | "kanban") => void;
  toggleColumn: (key: string) => void;
}

export function useCrmViewState(): CrmViewState {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? "";
  const sortDir = (searchParams.get("dir") ?? "asc") as "asc" | "desc";
  const viewType = (searchParams.get("viewType") ?? "table") as "table" | "kanban";

  const hiddenColumns = useMemo((): Set<string> => {
    const raw = searchParams.get("hidden");
    if (!raw) return new Set();
    return new Set(raw.split(",").filter(Boolean));
  }, [searchParams]);

  const filters = useMemo((): CrmFilter[] => {
    const result: CrmFilter[] = [];
    searchParams.forEach((value, key) => {
      if (!key.startsWith("filter_")) return;
      const field = key.replace("filter_", "");
      const [operator, ...rest] = value.split(":");
      result.push({
        field,
        operator: (operator as CrmFilter["operator"]) ?? "is",
        value: rest.join(":"),
      });
    });
    return result;
  }, [searchParams]);

  const updateParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      updater(params);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const setSearch = useCallback(
    (v: string) => updateParams((p) => {
      if (v) p.set("search", v);
      else p.delete("search");
    }),
    [updateParams],
  );

  const setSort = useCallback(
    (field: string) => updateParams((p) => {
      const currentSort = p.get("sort");
      if (currentSort === field) {
        p.set("dir", p.get("dir") === "asc" ? "desc" : "asc");
      } else {
        p.set("sort", field);
        p.set("dir", "asc");
      }
    }),
    [updateParams],
  );

  const toggleSortDir = useCallback(
    () => updateParams((p) => p.set("dir", p.get("dir") === "asc" ? "desc" : "asc")),
    [updateParams],
  );

  const addFilter = useCallback(
    (filter: CrmFilter) => updateParams((p) => p.set(`filter_${filter.field}`, `${filter.operator}:${filter.value}`)),
    [updateParams],
  );

  const removeFilter = useCallback(
    (field: string) => updateParams((p) => p.delete(`filter_${field}`)),
    [updateParams],
  );

  const clearFilters = useCallback(
    () => updateParams((p) => {
      const keysToDelete: string[] = [];
      p.forEach((_, key) => { if (key.startsWith("filter_")) keysToDelete.push(key); });
      keysToDelete.forEach((k) => p.delete(k));
    }),
    [updateParams],
  );

  const setViewType = useCallback(
    (v: "table" | "kanban") => updateParams((p) => p.set("viewType", v)),
    [updateParams],
  );

  const toggleColumn = useCallback(
    (key: string) =>
      updateParams((p) => {
        const current = new Set((p.get("hidden") ?? "").split(",").filter(Boolean));
        if (current.has(key)) current.delete(key);
        else current.add(key);
        if (current.size === 0) p.delete("hidden");
        else p.set("hidden", [...current].join(","));
      }),
    [updateParams],
  );

  return { search, sort, sortDir, filters, viewType, hiddenColumns, setSearch, setSort, toggleSortDir, addFilter, removeFilter, clearFilters, setViewType, toggleColumn };
}

export function applyCrmFilters<T>(
  records: T[],
  { search, sort, sortDir, filters }: Pick<CrmViewState, "search" | "sort" | "sortDir" | "filters">,
  searchFields: (keyof T)[],
  sortValueFn?: (row: T, field: string) => string | number,
): T[] {
  let result = [...records];

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter((row) =>
      searchFields.some((f) => String(row[f] ?? "").toLowerCase().includes(q)),
    );
  }

  if (filters.length > 0 && sortValueFn) {
    result = result.filter((row) =>
      filters.every((f) => {
        const raw = sortValueFn(row, f.field);
        const rowVal = typeof raw === "number" ? raw : String(raw).toLowerCase();
        const filterVal = f.value.toLowerCase();

        switch (f.operator) {
          case "is":
            return String(rowVal) === filterVal;
          case "contains":
            return String(rowVal).includes(filterVal);
          case "gt":
            return typeof rowVal === "number"
              ? rowVal > Number(f.value)
              : String(rowVal) > filterVal;
          case "lt":
            return typeof rowVal === "number"
              ? rowVal < Number(f.value)
              : String(rowVal) < filterVal;
          default:
            return true;
        }
      }),
    );
  }

  if (sort && sortValueFn) {
    result.sort((a, b) => {
      const aVal = sortValueFn(a, sort);
      const bVal = sortValueFn(b, sort);
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  return result;
}
