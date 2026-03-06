import { getList, getOne, create, update } from "@/lib/api/crm";
import type { CrmTool } from "./types";

export const search_contacts: CrmTool<
  { query?: string; company_id?: number; limit?: number },
  { data: unknown[]; total: number }
> = {
  name: "search_contacts",
  description:
    "Search and list contacts. Use when the user asks about contacts, people, or to find someone by name or email. Supports free-text search across name and email.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Free-text search across first name, last name, email, and company name",
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
    if (params.company_id != null) filter.company_id = params.company_id;
    const result = await getList("contacts_summary", {
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      pagination: { page: 1, perPage: params.limit ?? 25 },
    });
    return result;
  },
};

export const get_contact: CrmTool<{ id: number }, unknown> = {
  name: "get_contact",
  description: "Fetch a single contact by ID. Use when you need full details for a specific contact.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "number", description: "Contact ID" },
    },
    required: ["id"],
  },
  async execute(params) {
    const data = await getOne("contacts_summary", params.id);
    return data;
  },
};

export const create_contact: CrmTool<
  { first_name?: string; last_name?: string; email?: string; company_id?: number },
  unknown
> = {
  name: "create_contact",
  description:
    "Create a new contact. Use when the user wants to add someone to the CRM.",
  parameters: {
    type: "object",
    properties: {
      first_name: { type: "string", description: "First name" },
      last_name: { type: "string", description: "Last name" },
      email: { type: "string", description: "Email address" },
      company_id: { type: "number", description: "Company ID to link" },
    },
    required: [],
  },
  async execute(params) {
    const data = await create("contacts", {
      first_name: params.first_name,
      last_name: params.last_name,
      email: params.email,
      company_id: params.company_id,
    });
    return data;
  },
};

export const update_contact: CrmTool<
  { id: number; first_name?: string; last_name?: string; email?: string },
  unknown
> = {
  name: "update_contact",
  description: "Update an existing contact. Use when the user wants to change contact details.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "number", description: "Contact ID" },
      first_name: { type: "string", description: "First name" },
      last_name: { type: "string", description: "Last name" },
      email: { type: "string", description: "Email address" },
    },
    required: ["id"],
  },
  async execute(params) {
    const { id, ...rest } = params;
    const data = await update("contacts", id, rest);
    return data;
  },
};
