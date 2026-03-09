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

export type ConversationContextMessage = {
  role: "user" | "assistant";
  content: string;
};

export const BASE_SYSTEM_PROMPT = `You are an AI assistant for a CRM called BasicsOS. Help the user manage contacts, deals, companies, tasks, and notes.

Rules:
- Never ask the user for IDs. Users reference records by name or description. Search first if needed, then use the id from the result.
- Use tools to look up or modify CRM records. Pass user-provided names directly as contact_name, deal_name, or company_name.
- Never invent tool names. Use only the exact tool names you were given.
- If the user asks for the latest/newest/most recent or nth latest record, call the matching search/list tool exactly once with no query unless the user gave a filter, then answer from the ordered results by position.
- When a lookup tool already answered the question, stop calling tools and give the final answer. Do not dump raw lookup output to the user.
- After receiving tool results, ALWAYS summarize in clear natural language. Never show raw JSON or IDs to the user.
- When answering from tool results, you may use full paragraphs — do not artificially limit yourself to brief replies. Only non-tool replies (e.g. general advice) should stay concise.
- Format lists as bullet points or numbered lists.
- If a search returns no results, say so clearly.
- If the user asks for multiple actions in one message, complete all of them in order before replying whenever the tools/results are sufficient.
- You currently support multi-step tool workflows. Before replying, make an internal ordered checklist of every required tool call and complete the full workflow in sequence.
- If a lookup is only step 1 of a larger workflow, NEVER stop after the lookup. Continue immediately to the next required tool call.
- When mentioning a record, use its EXACT name from the tool result.

Avoid redundant tool calls (CRITICAL):
- Use only ONE tool that can answer the user's question. Never call multiple tools that would return overlapping results for the same intent.
- Tasks: Use search_tasks for general queries ("any company", "upcoming", "anything coming up", by content/topic). Use list_tasks ONLY when the user names a specific contact or company. Never call both list_tasks and search_tasks for the same request. Never call list_tasks multiple times (e.g. for "all companies").
- Contacts, companies, deals: Use ONE search or get tool per intent. If search_contacts/search_companies/search_deals returns results, do not call get_* for the same lookup unless you need a single record's full details for a follow-up action.

Update workflow (CRITICAL — follow exactly):
1. When the user asks to update/rename/edit/change a record:
   - If you know the record's exact name → call update_contact / update_deal / update_company directly with company_name/contact_name/deal_name.
   - If the user describes a record by a detail (e.g. "the company about touching people") → call search_companies/search_contacts/search_deals/search_tasks ONCE. The result will show the name and id (e.g. "Katars (id: 42)"). Then IMMEDIATELY call the update tool using that id.
   - NEVER search more than once. NEVER search again after you already have results. Use the id from the first search result.
2. Available update tools: update_contact (fields: first_name, last_name, email), update_deal (fields: name, status, amount), update_company (fields: name, category, domain, description).
3. After any update, confirm to the user what changed.
4. Common multi-step patterns you must finish before replying:
   - search_companies/search_contacts/search_deals/search_tasks -> update_company/update_contact/update_deal
   - search_contacts/search_companies/search_tasks -> create_task
   - search_contacts/search_deals -> add_note
   - search_companies -> create_contact/create_deal`;

export const requestSchema = z.object({
  messages: z.array(z.any()),
  threadId: z.string().optional(),
  channel: z.enum(["chat", "voice", "automation"]).optional(),
});

export const searchContactsSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const getContactSchema = z
  .object({
    id: z.number().int().positive().optional(),
    contact_name: z.string().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.id && !v.contact_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide id or contact_name",
      });
    }
  });
export const createContactSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  company_id: z.number().int().positive().optional(),
  company_name: z.string().min(1).optional(),
});
export const updateContactSchema = z
  .object({
    id: z.number().int().positive().optional(),
    contact_name: z.string().min(1).optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.id && !v.contact_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide id or contact_name",
      });
    }
    if (
      v.first_name === undefined &&
      v.last_name === undefined &&
      v.email === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one update field (first_name, last_name, email) is required",
      });
    }
  });

export const searchDealsSchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const getDealSchema = z
  .object({
    id: z.number().int().positive().optional(),
    deal_name: z.string().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.id && !v.deal_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide id or deal_name",
      });
    }
  });
export const createDealSchema = z.object({
  name: z.string().min(1),
  status: z.string().optional(),
  company_id: z.number().int().positive().optional(),
  company_name: z.string().min(1).optional(),
  amount: z.number().optional(),
});
export const updateDealSchema = z
  .object({
    id: z.number().int().positive().optional(),
    deal_name: z.string().min(1).optional(),
    name: z.string().optional(),
    status: z.string().optional(),
    amount: z.number().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.id && !v.deal_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide id or deal_name",
      });
    }
    if (
      v.name === undefined &&
      v.status === undefined &&
      v.amount === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one update field (name, status, amount) is required",
      });
    }
  });

export const searchCompaniesSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const getCompanySchema = z
  .object({
    id: z.number().int().positive().optional(),
    company_name: z.string().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.id && !v.company_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide id or company_name",
      });
    }
  });
export const createCompanySchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  domain: z.string().optional(),
  description: z.string().optional(),
});
export const updateCompanySchema = z
  .object({
    id: z.number().int().positive().optional(),
    company_name: z.string().min(1).optional(),
    name: z.string().optional(),
    category: z.string().optional(),
    domain: z.string().optional(),
    description: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.id && !v.company_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide id or company_name",
      });
    }
    if (
      v.name === undefined &&
      v.category === undefined &&
      v.domain === undefined &&
      v.description === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one update field (name, category, domain, description) is required",
      });
    }
  });

export const searchTasksSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const listTasksSchema = z
  .object({
    contact_id: z.number().int().positive().optional(),
    contact_name: z.string().min(1).optional(),
    company_id: z.number().int().positive().optional(),
    company_name: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .superRefine((v, ctx) => {
    const byContact = v.contact_id || v.contact_name;
    const byCompany = v.company_id || v.company_name;
    if (!byContact && !byCompany) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide contact_id/contact_name or company_id/company_name",
      });
    }
    if (byContact && byCompany) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide only contact OR company, not both",
      });
    }
  });
export const createTaskSchema = z
  .object({
    contact_id: z.number().int().positive().optional(),
    contact_name: z.string().min(1).optional(),
    company_id: z.number().int().positive().optional(),
    company_name: z.string().min(1).optional(),
    text: z.string().min(1),
    type: z.string().optional(),
    due_date: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const byContact = v.contact_id || v.contact_name;
    const byCompany = v.company_id || v.company_name;
    if (!byContact && !byCompany) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide contact_id/contact_name or company_id/company_name",
      });
    }
    if (byContact && byCompany) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide only contact OR company, not both",
      });
    }
  });
export const completeTaskSchema = z.object({ id: z.number().int().positive() });

export const listNotesSchema = z
  .object({
    contact_id: z.number().int().positive().optional(),
    contact_name: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.contact_id && !v.contact_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide contact_id or contact_name",
      });
    }
  });
export const createNoteSchema = z
  .object({
    contact_id: z.number().int().positive().optional(),
    contact_name: z.string().min(1).optional(),
    text: z.string().min(1),
    type: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.contact_id && !v.contact_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide contact_id or contact_name",
      });
    }
  });
export const addNoteSchema = z
  .object({
    contact_id: z.number().int().positive().optional(),
    contact_name: z.string().min(1).optional(),
    deal_id: z.number().int().positive().optional(),
    deal_name: z.string().min(1).optional(),
    text: z.string().min(1),
  })
  .superRefine((v, ctx) => {
    const byId = v.contact_id || v.deal_id;
    const byName = v.contact_name || v.deal_name;
    if (!byId && !byName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide contact_id/contact_name or deal_id/deal_name",
      });
    }
    if ((v.contact_id || v.contact_name) && (v.deal_id || v.deal_name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide only contact OR deal, not both",
      });
    }
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
      description:
        "Fetch a single contact. Use contact_name (e.g. 'John Smith') or id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "Contact ID from a prior search" },
          contact_name: {
            type: "string",
            description: "Name or email to look up",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description:
        "Create a new contact. Use company_name to link to a company by name.",
      parameters: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string" },
          company_id: {
            type: "number",
            description: "Company ID from a prior search",
          },
          company_name: {
            type: "string",
            description: "Company name to link to",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_contact",
      description:
        "Update an existing contact. Use id (preferred, from a prior search) or contact_name. Call this immediately after finding the contact — do NOT search again.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "Contact ID from a prior search" },
          contact_name: {
            type: "string",
            description: "Name or email to look up",
          },
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string" },
        },
        required: [],
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
      description:
        "Fetch a single deal. Use deal_name (e.g. 'Acme Corp deal') or id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "Deal ID from a prior search" },
          deal_name: { type: "string", description: "Deal name to look up" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_deal",
      description:
        "Create a new deal. Use company_name to link to a company by name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string" },
          company_id: {
            type: "number",
            description: "Company ID from a prior search",
          },
          company_name: {
            type: "string",
            description: "Company name to link to",
          },
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
      description:
        "Update an existing deal. Use id (preferred, from a prior search) or deal_name. Call this immediately after finding the deal — do NOT search again.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "Deal ID from a prior search" },
          deal_name: { type: "string", description: "Deal name to look up" },
          name: { type: "string" },
          status: { type: "string" },
          amount: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_companies",
      description:
        "Search and list companies by name, category, or description.",
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
      name: "get_company",
      description: "Fetch a single company. Use company_name or id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "Company ID from a prior search" },
          company_name: {
            type: "string",
            description: "Company name to look up",
          },
        },
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
          description: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_company",
      description:
        "Update/rename an existing company. Use id (preferred, from a prior search result) or company_name. Call this immediately after finding the company — do NOT search again.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Company ID from a prior search (preferred)",
          },
          company_name: {
            type: "string",
            description: "Exact company name to look up",
          },
          name: { type: "string", description: "New name for the company" },
          category: { type: "string" },
          domain: { type: "string" },
          description: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tasks",
      description:
        "Search tasks by text, description, or type. Use for general queries like 'tasks with any company', 'upcoming tasks', or when searching by content. Do NOT also call list_tasks for the same request.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (task text, description, or type)",
          },
          limit: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description:
        "List tasks for a specific contact or company. Use ONLY when the user names a specific contact or company. For 'any company', 'all companies', or general task queries, use search_tasks instead. Do NOT call both list_tasks and search_tasks.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "number",
            description: "Contact ID from a prior search",
          },
          contact_name: {
            type: "string",
            description: "Contact name or email to look up",
          },
          company_id: {
            type: "number",
            description: "Company ID from a prior search",
          },
          company_name: {
            type: "string",
            description: "Company name to look up",
          },
          limit: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Create a task linked to a contact or company. Use contact_name/contact_id or company_name/company_id.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "number",
            description: "Contact ID from a prior search",
          },
          contact_name: {
            type: "string",
            description: "Contact name or email to look up",
          },
          company_id: {
            type: "number",
            description: "Company ID from a prior search",
          },
          company_name: {
            type: "string",
            description: "Company name to look up",
          },
          text: { type: "string" },
          type: { type: "string" },
          due_date: { type: "string" },
        },
        required: ["text"],
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
      description: "List notes for a contact. Use contact_name or contact_id.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "number",
            description: "Contact ID from a prior search",
          },
          contact_name: {
            type: "string",
            description: "Contact name or email to look up",
          },
          limit: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Add a note to a contact. Use contact_name or contact_id.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "number",
            description: "Contact ID from a prior search",
          },
          contact_name: {
            type: "string",
            description: "Contact name or email to look up",
          },
          text: { type: "string" },
          type: { type: "string" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_note",
      description:
        "Add a note to a contact or deal. Use contact_name/deal_name (e.g. 'Acme deal') or contact_id/deal_id.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "number",
            description: "Contact ID from a prior search",
          },
          contact_name: {
            type: "string",
            description: "Contact name or email to look up",
          },
          deal_id: {
            type: "number",
            description: "Deal ID from a prior search",
          },
          deal_name: { type: "string", description: "Deal name to look up" },
          text: { type: "string", description: "The note content" },
        },
        required: ["text"],
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

const WIKI_TOKEN_RE = /\[\[([a-z][a-z0-9-]*)\/(\d+)(#\w+)?\|([^\]]+)\]\]/g;

function stripInternalIds(text: string): string {
  return text.replace(/\s*\(id:\s*\d+\)/gi, "");
}

function wikiTokensToMarkdown(text: string): string {
  return text.replace(
    WIKI_TOKEN_RE,
    (_m, slug: string, id: string, hash: string | undefined, name: string) =>
      `[${name}](/objects/${slug}/${id}${hash ?? ""})`,
  );
}

function cleanUserFacingText(text: string): string {
  return wikiTokensToMarkdown(stripInternalIds(text))
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactConversationLine(text: string, maxLen = 280): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen - 3).trimEnd()}...`;
}

function formatToolResult(name: string, result: unknown): string {
  if (result === null || result === undefined) return `No results found.`;
  if (typeof result === "string") return cleanUserFacingText(result);
  if (Array.isArray(result)) {
    if (result.length === 0)
      return `No ${name.replace("search_", "").replace("list_", "")} found.`;
    return result
      .slice(0, 10)
      .map((item) => {
        if (typeof item !== "object" || !item) return String(item);
        const r = item as Record<string, unknown>;
        const label =
          r.name ??
          r.text ??
          [r.firstName ?? r.first_name, r.lastName ?? r.last_name]
            .filter(Boolean)
            .join(" ") ??
          "";
        const parts: string[] = [];
        if (label) parts.push(String(label));
        if (r.email) parts.push(String(r.email));
        if (r.status) parts.push(`status: ${r.status}`);
        if (r.amount != null)
          parts.push(`$${Number(r.amount).toLocaleString()}`);
        if (r.domain) parts.push(String(r.domain));
        if (r.category) parts.push(String(r.category));
        return `- ${parts.join(" | ") || JSON.stringify(r).slice(0, 200)}`;
      })
      .join("\n");
  }
  if (typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r.error) return `Error: ${r.error}`;
    const label =
      r.name ??
      r.text ??
      [r.firstName ?? r.first_name, r.lastName ?? r.last_name]
        .filter(Boolean)
        .join(" ") ??
      "";
    if (label) return `Found: ${label}`;
  }
  return JSON.stringify(result).slice(0, 500);
}

function extractStructuredText(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed;
}

function parseStructuredResponse(text: string): unknown | undefined {
  const candidate = extractStructuredText(text);
  if (!candidate || !/^[[{]/.test(candidate)) return undefined;
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

function summarizeStructuredResponse(value: unknown): string {
  if (typeof value === "string") return cleanUserFacingText(value);
  if (Array.isArray(value))
    return cleanUserFacingText(formatToolResult("results", value));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["response", "answer", "message", "text", "content"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return cleanUserFacingText(candidate);
      }
    }
    return cleanUserFacingText(formatToolResult("result", record));
  }
  return cleanUserFacingText(String(value));
}

function looksJsonLike(text: string): boolean {
  const candidate = extractStructuredText(text);
  return /^[[{]/.test(candidate);
}

export const toolFallbackText = (
  toolOutputs: Array<{ name: string; result: unknown }>,
): string => {
  if (toolOutputs.length === 0) {
    return "I could not complete that request. Please try again.";
  }
  const sections = toolOutputs
    .slice(0, 3)
    .map((t) => {
      const heading = t.name
        .replace(/_/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase());
      return `**${heading}**\n${formatToolResult(t.name, t.result)}`;
    })
    .join("\n\n");
  return `Here's what I found:\n\n${sections}`;
};

type RankedEntityIntent = {
  label: "company" | "contact" | "deal" | "task";
  toolNames: string[];
  rank: number;
  rankLabel: string;
};

function parseRequestedRank(
  queryText: string,
): { rank: number; rankLabel: string } | null {
  const lower = queryText.toLowerCase();
  if (/\bsecond\s+(?:latest|newest|most recent|last)\b/.test(lower)) {
    return { rank: 2, rankLabel: "second latest" };
  }
  if (/\bthird\s+(?:latest|newest|most recent|last)\b/.test(lower)) {
    return { rank: 3, rankLabel: "third latest" };
  }
  if (/\bfourth\s+(?:latest|newest|most recent|last)\b/.test(lower)) {
    return { rank: 4, rankLabel: "fourth latest" };
  }
  const numericOrdinal =
    /\b(\d+)(?:st|nd|rd|th)\s+(?:latest|newest|most recent|last)\b/.exec(lower);
  if (numericOrdinal) {
    const rank = Number(numericOrdinal[1]);
    if (Number.isFinite(rank) && rank > 0) {
      return {
        rank,
        rankLabel: `${rank}${numericOrdinal[0].match(/\d+(st|nd|rd|th)/)?.[1] ?? "th"} latest`,
      };
    }
  }
  if (
    /\b(latest|newest|most recent|recently added|last added)\b/.test(lower) ||
    /\bwhat(?:'s| is)\s+the\s+last\b/.test(lower)
  ) {
    return { rank: 1, rankLabel: "latest" };
  }
  return null;
}

function detectRankedEntityIntent(
  queryText: string,
): RankedEntityIntent | null {
  const lower = queryText.toLowerCase();
  const requestedRank = parseRequestedRank(queryText);
  if (!requestedRank) return null;

  if (/\b(company|companies|organization|organizations)\b/.test(lower)) {
    return {
      label: "company",
      toolNames: ["search_companies", "get_company"],
      rank: requestedRank.rank,
      rankLabel: requestedRank.rankLabel,
    };
  }
  if (/\b(contact|contacts|person|people|lead|leads)\b/.test(lower)) {
    return {
      label: "contact",
      toolNames: ["search_contacts", "get_contact"],
      rank: requestedRank.rank,
      rankLabel: requestedRank.rankLabel,
    };
  }
  if (/\b(deal|deals|opportunity|opportunities)\b/.test(lower)) {
    return {
      label: "deal",
      toolNames: ["search_deals", "get_deal"],
      rank: requestedRank.rank,
      rankLabel: requestedRank.rankLabel,
    };
  }
  if (
    /\b(task|tasks|todo|todos|reminder|reminders|follow-up|follow up)\b/.test(
      lower,
    )
  ) {
    return {
      label: "task",
      toolNames: ["search_tasks", "list_tasks"],
      rank: requestedRank.rank,
      rankLabel: requestedRank.rankLabel,
    };
  }
  return null;
}

function extractLinkedRecords(
  result: unknown,
): Array<{ id: number; name: string }> {
  if (typeof result !== "string") return [];
  return [...result.matchAll(/\[\[[a-z][a-z0-9-]*\/(\d+)\|([^\]]+)\]\]/gi)]
    .map((match) => ({
      id: Number(match[1]),
      name: cleanUserFacingText(match[2]),
    }))
    .filter((record) => Number.isFinite(record.id) && record.name);
}

export function deriveToolAnswer(
  queryText: string,
  toolOutputs: Array<{ name: string; result: unknown }>,
): string {
  const writeSummaries = toolOutputs
    .map((output) => output.result)
    .filter((result): result is string => typeof result === "string")
    .map((result) => cleanUserFacingText(result).trim())
    .filter((result) =>
      /^(Created|Updated|Task created|Note added)/i.test(result),
    );
  if (writeSummaries.length > 0) {
    return writeSummaries.join("\n");
  }

  const rankedIntent = detectRankedEntityIntent(queryText);
  if (rankedIntent) {
    const relevantOutput = toolOutputs.find((output) =>
      rankedIntent.toolNames.includes(output.name),
    );
    if (typeof relevantOutput?.result === "string") {
      const cleaned = cleanUserFacingText(relevantOutput.result);
      if (/^(No .* found\.?|Not found\.?)$/i.test(cleaned)) {
        return `I couldn't find any ${rankedIntent.label}s yet.`;
      }
      const records = extractLinkedRecords(relevantOutput.result);
      const rankedRecord = records[rankedIntent.rank - 1];
      if (rankedRecord) {
        return `The ${rankedIntent.rankLabel} ${rankedIntent.label} you added is ${rankedRecord.name}.`;
      }
      if (records.length > 0) {
        return `I only found ${records.length} ${rankedIntent.label}${records.length === 1 ? "" : "s"}, so I couldn't determine the ${rankedIntent.rankLabel} one.`;
      }
    }
  }

  return "";
}

export function finalizeAssistantText(
  text: string,
  toolOutputs: Array<{ name: string; result: unknown }> = [],
): string {
  const cleaned = cleanUserFacingText(text);
  if (!cleaned) {
    return "";
  }

  const parsed = parseStructuredResponse(cleaned);
  if (parsed !== undefined) {
    const summarized = summarizeStructuredResponse(parsed);
    if (summarized) return summarized;
  }

  if (looksJsonLike(cleaned) && toolOutputs.length > 0) {
    return "";
  }

  return cleaned;
}

export function buildRecentConversationContext(
  messages: ConversationContextMessage[],
  maxMessages = 8,
): string {
  const recent = messages
    .filter((message) => message.content.trim())
    .slice(-maxMessages);
  if (recent.length === 0) return "";

  const lines = recent.map((message) => {
    const label = message.role === "user" ? "User" : "Assistant";
    return `- ${label}: ${compactConversationLine(message.content)}`;
  });

  return [
    "## Recent conversation",
    'Use the recent turns below to resolve follow-ups like "it", "that company", "same contact", or "do that again".',
    ...lines,
  ].join("\n");
}

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
