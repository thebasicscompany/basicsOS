/**
 * CRM tool schemas for the Gateway chat proxy.
 * Must match src/lib/gateway/tools/* - execution happens on the client.
 */
import { tool, jsonSchema } from "ai";
const CRM_TOOL_SCHEMAS = [
    {
        name: "search_contacts",
        description: "Search and list contacts. Use when the user asks about contacts, people, or to find someone by name or email. Supports free-text search across name and email.",
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
    },
    {
        name: "get_contact",
        description: "Fetch a single contact by ID. Use when you need full details for a specific contact.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "number", description: "Contact ID" },
            },
            required: ["id"],
        },
    },
    {
        name: "create_contact",
        description: "Create a new contact. Use when the user wants to add someone to the CRM.",
        parameters: {
            type: "object",
            properties: {
                first_name: { type: "string", description: "First name" },
                last_name: { type: "string", description: "Last name" },
                email: { type: "string", description: "Email address" },
                company_id: {
                    type: "number",
                    description: "Company ID to link",
                },
            },
            required: [],
        },
    },
    {
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
    },
    {
        name: "search_deals",
        description: "Search and list deals. Use when the user asks about deals, pipeline, or opportunities. Supports filtering by status.",
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
    },
    {
        name: "get_deal",
        description: "Fetch a single deal by ID. Use when you need full details for a specific deal.",
        parameters: {
            type: "object",
            properties: { id: { type: "number", description: "Deal ID" } },
            required: ["id"],
        },
    },
    {
        name: "create_deal",
        description: "Create a new deal. Use when the user wants to add an opportunity to the pipeline.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Deal name" },
                status: { type: "string", description: "Deal status" },
                company_id: {
                    type: "number",
                    description: "Company ID to link",
                },
                amount: {
                    type: "number",
                    description: "Deal amount in cents",
                },
            },
            required: ["name"],
        },
    },
    {
        name: "update_deal",
        description: "Update an existing deal. Use when the user wants to change deal status, amount, or other details.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "number", description: "Deal ID" },
                name: { type: "string", description: "Deal name" },
                status: { type: "string", description: "Deal status" },
                amount: {
                    type: "number",
                    description: "Deal amount in cents",
                },
            },
            required: ["id"],
        },
    },
    {
        name: "search_companies",
        description: "Search and list companies. Use when the user asks about companies, organizations, or accounts. Supports free-text search on name and category.",
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
    },
    {
        name: "create_company",
        description: "Create a new company. Use when the user wants to add an organization to the CRM.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Company name" },
                category: { type: "string", description: "Category" },
                domain: { type: "string", description: "Domain URL" },
            },
            required: ["name"],
        },
    },
    {
        name: "list_tasks",
        description: "List tasks for a contact. Use when the user asks about tasks, to-dos, or follow-ups for a specific person.",
        parameters: {
            type: "object",
            properties: {
                contact_id: {
                    type: "number",
                    description: "Contact ID to list tasks for",
                },
                limit: {
                    type: "number",
                    description: "Max number of results (default 25)",
                },
            },
            required: ["contact_id"],
        },
    },
    {
        name: "create_task",
        description: "Create a task linked to a contact. Use when the user wants to add a follow-up, to-do, or reminder for someone.",
        parameters: {
            type: "object",
            properties: {
                contact_id: {
                    type: "number",
                    description: "Contact ID to attach the task to",
                },
                text: {
                    type: "string",
                    description: "Task description or title",
                },
                type: {
                    type: "string",
                    description: "Task type (e.g. call, email, meeting)",
                },
                due_date: {
                    type: "string",
                    description: "Due date in ISO format (e.g. 2025-03-01)",
                },
            },
            required: ["contact_id", "text"],
        },
    },
    {
        name: "complete_task",
        description: "Mark a task as done. Use when the user wants to complete or finish a task.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "number", description: "Task ID to complete" },
            },
            required: ["id"],
        },
    },
    {
        name: "list_notes",
        description: "List notes for a contact. Use when the user asks about notes, comments, or history for a specific person.",
        parameters: {
            type: "object",
            properties: {
                contact_id: {
                    type: "number",
                    description: "Contact ID to list notes for",
                },
                limit: {
                    type: "number",
                    description: "Max number of results (default 25)",
                },
            },
            required: ["contact_id"],
        },
    },
    {
        name: "create_note",
        description: "Add a note to a contact. Use when the user wants to record a note, comment, or update about someone.",
        parameters: {
            type: "object",
            properties: {
                contact_id: {
                    type: "number",
                    description: "Contact ID to add the note to",
                },
                text: { type: "string", description: "Note content" },
                type: {
                    type: "string",
                    description: "Note type (e.g. call, meeting, email)",
                },
            },
            required: ["contact_id", "text"],
        },
    },
];
export function buildGatewayTools() {
    const tools = {};
    for (const t of CRM_TOOL_SCHEMAS) {
        tools[t.name] = tool({
            description: t.description,
            parameters: jsonSchema(t.parameters),
            execute: async () => {
                // Not called: maxSteps: 1 streams tool calls to client for execution
                return "";
            },
        });
    }
    return tools;
}
