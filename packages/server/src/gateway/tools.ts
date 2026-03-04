/**
 * CRM tool schemas for the Gateway chat proxy.
 * Must match src/lib/gateway/tools/* - execution happens on the client.
 */
import { tool, jsonSchema } from "ai";

const CRM_TOOL_SCHEMAS = [
  {
    name: "search_contacts",
    description:
      "Search and list contacts. Use when the user asks about contacts, people, or to find someone by name or email. Supports free-text search across name and email.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Free-text search across first name, last name, email, and company name" },
        status: { type: "string" as const, description: "Filter by contact status (e.g. lead, prospect, customer)" },
        company_id: { type: "number" as const, description: "Filter by company ID" },
        limit: { type: "number" as const, description: "Max number of results (default 25)" },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_contact",
    description: "Fetch a single contact by ID. Use when you need full details for a specific contact.",
    parameters: {
      type: "object" as const,
      properties: { id: { type: "number" as const, description: "Contact ID" } },
      required: ["id"] as string[],
    },
  },
  {
    name: "create_contact",
    description: "Create a new contact. Use when the user wants to add someone to the CRM.",
    parameters: {
      type: "object" as const,
      properties: {
        first_name: { type: "string" as const, description: "First name" },
        last_name: { type: "string" as const, description: "Last name" },
        email: { type: "string" as const, description: "Email address" },
        company_id: { type: "number" as const, description: "Company ID to link" },
        status: { type: "string" as const, description: "Contact status" },
      },
      required: [] as string[],
    },
  },
  {
    name: "update_contact",
    description: "Update an existing contact. Use when the user wants to change contact details.",
    parameters: {
      type: "object" as const,
      properties: {
        id: { type: "number" as const, description: "Contact ID" },
        first_name: { type: "string" as const, description: "First name" },
        last_name: { type: "string" as const, description: "Last name" },
        email: { type: "string" as const, description: "Email address" },
        status: { type: "string" as const, description: "Contact status" },
      },
      required: ["id"] as string[],
    },
  },
  {
    name: "search_deals",
    description:
      "Search and list deals. Use when the user asks about deals, pipeline, or opportunities. Supports filtering by stage and category.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Free-text search on deal name" },
        stage: { type: "string" as const, description: "Filter by deal stage (e.g. qualification, proposal, negotiation)" },
        category: { type: "string" as const, description: "Filter by deal category" },
        company_id: { type: "number" as const, description: "Filter by company ID" },
        limit: { type: "number" as const, description: "Max number of results (default 25)" },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_deal",
    description: "Fetch a single deal by ID. Use when you need full details for a specific deal.",
    parameters: {
      type: "object" as const,
      properties: { id: { type: "number" as const, description: "Deal ID" } },
      required: ["id"] as string[],
    },
  },
  {
    name: "create_deal",
    description: "Create a new deal. Use when the user wants to add an opportunity to the pipeline.",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Deal name" },
        stage: { type: "string" as const, description: "Deal stage" },
        category: { type: "string" as const, description: "Deal category" },
        company_id: { type: "number" as const, description: "Company ID to link" },
        amount: { type: "number" as const, description: "Deal amount in cents" },
        description: { type: "string" as const, description: "Deal description" },
      },
      required: ["name"] as string[],
    },
  },
  {
    name: "update_deal",
    description: "Update an existing deal. Use when the user wants to change deal stage, amount, or other details.",
    parameters: {
      type: "object" as const,
      properties: {
        id: { type: "number" as const, description: "Deal ID" },
        name: { type: "string" as const, description: "Deal name" },
        stage: { type: "string" as const, description: "Deal stage" },
        category: { type: "string" as const, description: "Deal category" },
        amount: { type: "number" as const, description: "Deal amount in cents" },
        description: { type: "string" as const, description: "Deal description" },
      },
      required: ["id"] as string[],
    },
  },
  {
    name: "search_companies",
    description:
      "Search and list companies. Use when the user asks about companies, organizations, or accounts. Supports free-text search on name, city, and sector.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Free-text search across company name, city, and sector" },
        sector: { type: "string" as const, description: "Filter by sector/industry" },
        limit: { type: "number" as const, description: "Max number of results (default 25)" },
      },
      required: [] as string[],
    },
  },
  {
    name: "create_company",
    description: "Create a new company. Use when the user wants to add an organization to the CRM.",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Company name" },
        sector: { type: "string" as const, description: "Industry/sector" },
        city: { type: "string" as const, description: "City" },
        website: { type: "string" as const, description: "Website URL" },
      },
      required: ["name"] as string[],
    },
  },
  {
    name: "list_tasks",
    description:
      "List tasks for a contact. Use when the user asks about tasks, to-dos, or follow-ups for a specific person.",
    parameters: {
      type: "object" as const,
      properties: {
        contact_id: { type: "number" as const, description: "Contact ID to list tasks for" },
        limit: { type: "number" as const, description: "Max number of results (default 25)" },
      },
      required: ["contact_id"] as string[],
    },
  },
  {
    name: "create_task",
    description:
      "Create a task linked to a contact. Use when the user wants to add a follow-up, to-do, or reminder for someone.",
    parameters: {
      type: "object" as const,
      properties: {
        contact_id: { type: "number" as const, description: "Contact ID to attach the task to" },
        text: { type: "string" as const, description: "Task description or title" },
        type: { type: "string" as const, description: "Task type (e.g. call, email, meeting)" },
        due_date: { type: "string" as const, description: "Due date in ISO format (e.g. 2025-03-01)" },
      },
      required: ["contact_id", "text"] as string[],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as done. Use when the user wants to complete or finish a task.",
    parameters: {
      type: "object" as const,
      properties: { id: { type: "number" as const, description: "Task ID to complete" } },
      required: ["id"] as string[],
    },
  },
  {
    name: "list_notes",
    description:
      "List notes for a contact. Use when the user asks about notes, comments, or history for a specific person.",
    parameters: {
      type: "object" as const,
      properties: {
        contact_id: { type: "number" as const, description: "Contact ID to list notes for" },
        limit: { type: "number" as const, description: "Max number of results (default 25)" },
      },
      required: ["contact_id"] as string[],
    },
  },
  {
    name: "create_note",
    description:
      "Add a note to a contact. Use when the user wants to record a note, comment, or update about someone.",
    parameters: {
      type: "object" as const,
      properties: {
        contact_id: { type: "number" as const, description: "Contact ID to add the note to" },
        text: { type: "string" as const, description: "Note content" },
        type: { type: "string" as const, description: "Note type (e.g. call, meeting, email)" },
      },
      required: ["contact_id", "text"] as string[],
    },
  },
];

export function buildGatewayTools() {
  const tools: Record<string, unknown> = {};
  for (const t of CRM_TOOL_SCHEMAS) {
    tools[t.name] = tool({
      description: t.description,
      parameters: jsonSchema(t.parameters as unknown as Parameters<typeof jsonSchema>[0]),
      execute: async (): Promise<unknown> => {
        // Not called: maxSteps: 1 streams tool calls to client for execution
        return "";
      },
    });
  }
  return tools;
}
