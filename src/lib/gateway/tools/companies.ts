import { getList, create } from "@/lib/api/crm";
import type { CrmTool } from "./types";

export const search_companies: CrmTool<
  { query?: string; category?: string; limit?: number },
  { data: unknown[]; total: number }
> = {
  name: "search_companies",
  description:
    "Search and list companies. Use when the user asks about companies, organizations, or accounts. Supports free-text search on name and category.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Free-text search across company name and category",
      },
      category: {
        type: "string",
        description: "Filter by category",
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
    if (params.category) filter.category = params.category;
    const result = await getList("companies_summary", {
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      pagination: { page: 1, perPage: params.limit ?? 25 },
    });
    return result;
  },
};

export const create_company: CrmTool<
  { name: string; category?: string; domain?: string },
  unknown
> = {
  name: "create_company",
  description:
    "Create a new company. Use when the user wants to add an organization to the CRM.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Company name" },
      category: { type: "string", description: "Category" },
      domain: { type: "string", description: "Domain URL" },
    },
    required: ["name"],
  },
  async execute(params) {
    const data = await create("companies", {
      name: params.name,
      category: params.category,
      domain: params.domain,
    });
    return data;
  },
};
