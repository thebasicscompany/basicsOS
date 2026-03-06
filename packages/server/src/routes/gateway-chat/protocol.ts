import { z } from "zod";

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

type UiMessage = {
  role: string;
  content?: unknown;
  parts?: Array<{ type: string; text?: string }>;
};

export const BASE_SYSTEM_PROMPT =
  "You are an AI assistant for a CRM. Help the user manage contacts, deals, companies, tasks, and notes. Be concise and helpful. Always use tools for specific record lookups or mutations.";

export const requestSchema = z.object({
  messages: z.array(z.any()),
  threadId: z.string().optional(),
  channel: z.enum(["chat", "voice", "automation"]).optional(),
});

export const searchContactsSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const getContactSchema = z.object({ id: z.number().int().positive() });
export const createContactSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  company_id: z.number().int().positive().optional(),
});
export const updateContactSchema = z
  .object({
    id: z.number().int().positive(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email().optional(),
  })
  .superRefine((v, ctx) => {
    if (
      v.first_name === undefined &&
      v.last_name === undefined &&
      v.email === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field is required",
      });
    }
  });

export const searchDealsSchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const getDealSchema = z.object({ id: z.number().int().positive() });
export const createDealSchema = z.object({
  name: z.string().min(1),
  status: z.string().optional(),
  company_id: z.number().int().positive().optional(),
  amount: z.number().optional(),
});
export const updateDealSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    status: z.string().optional(),
    amount: z.number().optional(),
  })
  .superRefine((v, ctx) => {
    if (
      v.name === undefined &&
      v.status === undefined &&
      v.amount === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field is required",
      });
    }
  });

export const searchCompaniesSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const createCompanySchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  domain: z.string().optional(),
});

export const listTasksSchema = z.object({
  contact_id: z.number().int().positive(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const createTaskSchema = z.object({
  contact_id: z.number().int().positive(),
  text: z.string().min(1),
  type: z.string().optional(),
  due_date: z.string().optional(),
});
export const completeTaskSchema = z.object({ id: z.number().int().positive() });

export const listNotesSchema = z.object({
  contact_id: z.number().int().positive(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const createNoteSchema = z.object({
  contact_id: z.number().int().positive(),
  text: z.string().min(1),
  type: z.string().optional(),
});

export const OPENAI_TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search and list contacts by name, email, or company name.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact",
      description: "Fetch a single contact by ID.",
      parameters: {
        type: "object",
        properties: { id: { type: "number" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Create a new contact.",
      parameters: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string" },
          company_id: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_contact",
      description: "Update an existing contact.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_deals",
      description: "Search and list deals.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          status: { type: "string" },
          limit: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_deal",
      description: "Fetch a single deal by ID.",
      parameters: {
        type: "object",
        properties: { id: { type: "number" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_deal",
      description: "Create a new deal.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string" },
          company_id: { type: "number" },
          amount: { type: "number" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_deal",
      description: "Update an existing deal.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number" },
          name: { type: "string" },
          status: { type: "string" },
          amount: { type: "number" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_companies",
      description: "Search and list companies.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_company",
      description: "Create a new company.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string" },
          domain: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "List tasks for a contact.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "number" },
          limit: { type: "number" },
        },
        required: ["contact_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a task linked to a contact.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "number" },
          text: { type: "string" },
          type: { type: "string" },
          due_date: { type: "string" },
        },
        required: ["contact_id", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Mark a task as done.",
      parameters: {
        type: "object",
        properties: { id: { type: "number" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "List notes for a contact.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "number" },
          limit: { type: "number" },
        },
        required: ["contact_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Add a note to a contact.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "number" },
          text: { type: "string" },
          type: { type: "string" },
        },
        required: ["contact_id", "text"],
      },
    },
  },
] as const;

export const limitFrom = (n?: number): number => {
  if (typeof n !== "number" || !Number.isFinite(n)) return 25;
  return Math.max(1, Math.min(100, Math.trunc(n)));
};

export const sdkPart = (code: string, value: unknown): string =>
  `${code}:${JSON.stringify(value)}\n`;

export const toolFallbackText = (
  toolOutputs: Array<{ name: string; result: unknown }>,
): string => {
  if (toolOutputs.length === 0) {
    return "I could not complete that request. Please try again.";
  }
  const preview = toolOutputs
    .slice(0, 3)
    .map((t) => `${t.name}: ${JSON.stringify(t.result).slice(0, 700)}`)
    .join("\n\n");
  return `I completed the requested CRM tool action(s), but the model could not finish the final phrasing step. Here are the grounded results:\n\n${preview}`;
};

function uiMessageText(msg: UiMessage): string {
  if (typeof msg.content === "string") return msg.content;
  return (msg.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

export function toOpenAIMessages(uiMessages: unknown[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const raw of uiMessages) {
    const msg = raw as UiMessage;
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    const text = uiMessageText(msg).trim();
    if (!text) continue;
    out.push({ role: msg.role, content: text } as ChatMessage);
  }
  return out;
}
