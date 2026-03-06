import { getList, getOne, create, update } from "@/lib/api/crm";
import type { CrmTool } from "./types";

export const search_deals: CrmTool<
  {
    query?: string;
    status?: string;
    company_id?: number;
    limit?: number;
  },
  { data: unknown[]; total: number }
> = {
  name: "search_deals",
  description:
    "Search and list deals. Use when the user asks about deals, pipeline, or opportunities. Supports filtering by status.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Free-text search on deal name",
      },
      status: {
        type: "string",
        description: "Filter by deal status (e.g. opportunity, proposal-made, in-negotiation, won, lost)",
      },
      company_id: {
        type: "number",
        description: "Filter by company ID",
      },
      limit: {
        type: "number",
        description: "Max number of results (default 25)",
      },
    },
    required: [],
  },
  async execute(params) {
    const filter: Record<string, unknown> = {};
    if (params.query?.trim()) filter.q = params.query.trim();
    if (params.status) filter.status = params.status;
    if (params.company_id != null) filter.company_id = params.company_id;
    const result = await getList("deals", {
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      pagination: { page: 1, perPage: params.limit ?? 25 },
    });
    return result;
  },
};

export const get_deal: CrmTool<{ id: number }, unknown> = {
  name: "get_deal",
  description: "Fetch a single deal by ID. Use when you need full details for a specific deal.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "number", description: "Deal ID" },
    },
    required: ["id"],
  },
  async execute(params) {
    const data = await getOne("deals", params.id);
    return data;
  },
};

export const create_deal: CrmTool<
  {
    name: string;
    status?: string;
    company_id?: number;
    amount?: number;
  },
  unknown
> = {
  name: "create_deal",
  description:
    "Create a new deal. Use when the user wants to add an opportunity to the pipeline.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Deal name" },
      status: { type: "string", description: "Deal status" },
      company_id: { type: "number", description: "Company ID to link" },
      amount: { type: "number", description: "Deal amount in cents" },
    },
    required: ["name"],
  },
  async execute(params) {
    const data = await create("deals", {
      name: params.name,
      status: params.status ?? "opportunity",
      company_id: params.company_id,
      amount: params.amount,
    });
    return data;
  },
};

export const update_deal: CrmTool<
  {
    id: number;
    name?: string;
    status?: string;
    amount?: number;
  },
  unknown
> = {
  name: "update_deal",
  description:
    "Update an existing deal. Use when the user wants to change deal status, amount, or other details.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "number", description: "Deal ID" },
      name: { type: "string", description: "Deal name" },
      status: { type: "string", description: "Deal status" },
      amount: { type: "number", description: "Deal amount in cents" },
    },
    required: ["id"],
  },
  async execute(params) {
    const { id, ...rest } = params;
    const data = await update("deals", id, rest);
    return data;
  },
};
