import * as nocoApi from "./crm-nocodb";
import type { FilterDef } from "./crm-nocodb";

export interface ListParams {
  pagination?: { page: number; perPage: number };
  sort?: { field: string; order: "ASC" | "DESC" };
  filter?: Record<string, unknown>;
  /** View-level filters (sent as generic filters to API) */
  viewFilters?: FilterDef[];
  /** Legacy: pre-built where clause (parsed to viewFilters if viewFilters not set) */
  extraWhere?: string;
}

export const getList = nocoApi.getList;
export const getOne = nocoApi.getOne;
export const create = nocoApi.create;
export const update = nocoApi.update;
export const remove = nocoApi.remove;
