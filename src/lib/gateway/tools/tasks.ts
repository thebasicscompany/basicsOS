import { getList, create, update } from "@/lib/api/crm";
import type { CrmTool } from "./types";

export const list_tasks: CrmTool<
  { contact_id: number; limit?: number },
  { data: unknown[]; total: number }
> = {
  name: "list_tasks",
  description:
    "List tasks for a contact. Use when the user asks about tasks, to-dos, or follow-ups for a specific person.",
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
  async execute(params) {
    const result = await getList("tasks", {
      filter: { contact_id: params.contact_id },
      pagination: { page: 1, perPage: params.limit ?? 25 },
    });
    return result;
  },
};

export const create_task: CrmTool<
  {
    contact_id?: number;
    text: string;
    type?: string;
    due_date?: string;
  },
  unknown
> = {
  name: "create_task",
  description:
    "Create a task. Text is required; contact_id is optional — use for standalone to-dos or when linking to a contact.",
  parameters: {
    type: "object",
    properties: {
      contact_id: {
        type: "number",
        description: "Optional contact ID to attach the task to",
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
    required: ["text"],
  },
  async execute(params) {
    const data = await create("tasks", {
      ...(params.contact_id != null
        ? { contact_id: params.contact_id }
        : {}),
      text: params.text,
      type: params.type,
      due_date: params.due_date,
    });
    return data;
  },
};

export const complete_task: CrmTool<{ id: number }, unknown> = {
  name: "complete_task",
  description:
    "Mark a task as done. Use when the user wants to complete or finish a task.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "number", description: "Task ID to complete" },
    },
    required: ["id"],
  },
  async execute(params) {
    const data = await update("tasks", params.id, {
      done_date: new Date().toISOString(),
    });
    return data;
  },
};
