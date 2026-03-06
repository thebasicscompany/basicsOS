/**
 * CRM API implementation that calls the Hono backend (/api/:resource).
 */

import { fetchApi, fetchApiList } from "@/lib/api";

export interface ListParams {
  pagination?: { page: number; perPage: number };
  sort?: { field: string; order: "ASC" | "DESC" } | Array<{ field: string; order: "ASC" | "DESC" }>;
  filter?: Record<string, unknown>;
  /** View-level filters (sent as generic filters to API) */
  viewFilters?: FilterDef[];
  /** Legacy: pre-built where clause (parsed to viewFilters if viewFilters not set) */
  extraWhere?: string;
}

/** Parsed filter for the generic filters query param */
export interface FilterDef {
  field: string;
  op: string;
  value: string;
  logicalOp?: "and" | "or";
}

/** Parse where clause into FilterDef[] for the Hono filters param. */
export function parseWhereToFilters(where: string): FilterDef[] {
  const filters: FilterDef[] = [];
  const clauseRe = /\(([^,]+),([^,]+),([^)]*)\)/g;
  let match;
  while ((match = clauseRe.exec(where)) !== null) {
    const op = match[2].toLowerCase();
    const normalizedOp =
      op === "is" && (match[3] === "" || match[3].toLowerCase() === "null")
        ? "blank"
        : op === "isnot" && (match[3] === "" || match[3].toLowerCase() === "null")
          ? "notblank"
          : op;
    filters.push({
      field: match[1],
      op: normalizedOp,
      value: match[3] ?? "",
    });
  }
  return filters;
}

export async function getList<T>(
  resource: string,
  params: ListParams = {},
): Promise<{ data: T[]; total: number }> {
  const {
    pagination = { page: 1, perPage: 25 },
    sort,
    filter = {},
    viewFilters,
    extraWhere,
  } = params;

  const start = (pagination.page - 1) * pagination.perPage;
  const end = start + pagination.perPage - 1;

  const qs = new URLSearchParams();
  qs.set("range", JSON.stringify([start, end]));

  if (Array.isArray(sort)) {
    if (sort.length === 1) {
      qs.set("sort", sort[0].field);
      qs.set("order", sort[0].order ?? "ASC");
    } else if (sort.length > 1) {
      qs.set("sorts", JSON.stringify(sort));
    }
  } else if (sort?.field) {
    qs.set("sort", sort.field);
    qs.set("order", sort.order ?? "ASC");
  }

  if (Object.keys(filter).length > 0) {
    qs.set("filter", JSON.stringify(filter));
  }

  const filtersToSend =
    viewFilters ?? (extraWhere ? parseWhereToFilters(extraWhere) : []);
  if (filtersToSend.length > 0) {
    qs.set("filters", JSON.stringify(filtersToSend));
  }

  return fetchApiList<T>(`/api/${resource}?${qs.toString()}`);
}

export async function getOne<T>(
  resource: string,
  id: number | string,
): Promise<T> {
  return fetchApi<T>(`/api/${resource}/${id}`);
}

export async function create<T>(
  resource: string,
  data: unknown,
): Promise<T> {
  return fetchApi<T>(`/api/${resource}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function update<T>(
  resource: string,
  id: number | string,
  data: unknown,
): Promise<T> {
  const body = { ...(data as Record<string, unknown>) };
  delete body.id;
  delete body.Id;
  return fetchApi<T>(`/api/${resource}/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function remove<T>(
  resource: string,
  id: number | string,
): Promise<T> {
  const existing = await getOne<T>(resource, id);
  await fetchApi(`/api/${resource}/${id}`, { method: "DELETE" });
  return existing;
}
