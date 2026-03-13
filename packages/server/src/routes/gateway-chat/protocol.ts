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
- If the user asks for advice, judgment, or a recommendation about a specific CRM record, look it up with the appropriate search/get tool first, then answer using that record's actual CRM data.
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
2. Available update tools: update_contact (fields: first_name, last_name, email), update_deal (fields: name, status, amount), update_company (fields: name, category, domain, description). For deals, "stage" and "status" mean the same thing — when the user asks to change the stage, update the status.
3. After any update, confirm to the user what changed.
4. Common multi-step patterns you must finish before replying:
   - search_companies/search_contacts/search_deals/search_tasks -> update_company/update_contact/update_deal
   - search_contacts/search_companies/search_tasks -> create_task
   - search_contacts/search_deals -> add_note

Record creation workflow (CRITICAL):
- Before creating ANY record, check what fields the user has provided vs what's missing.
- If required or important fields are missing, ask for them SPECIFICALLY — name the exact fields AND the person/company you need them for.
- Contact fields: first_name/last_name (required), email (ask if missing), company (ask if missing), phone (ask if missing). Example: "What's Sarah's email address, phone number, and company?"
- For BULK contacts (multiple people at once without details), ask per-person: "For Mike Torres — what's his email, phone, and company? For Elena Vasquez — same info?"
- Deal fields: name (required), amount (ask: "What's the deal value?"), stage/status (ask: "What stage — Lead, Qualified, Proposal, or Closed Won?"), company (ask if missing).
- Company fields: name (required), domain (ask: "What's their website domain?"), category (ask: "What category — e.g. B2B, SaaS, Enterprise?").
- Ask for ALL missing important fields in ONE focused question per entity, not multiple rounds.
- Only proceed to create AFTER you have the missing fields, OR if the user explicitly says to skip them (e.g. "just add the name for now").
- When creating a contact or deal with a company_name, pass company_name directly — do NOT search for the company first. The tool will auto-create the company if it does not exist.
- After creating a contact with a company, or a deal with a company, confirm the linkage explicitly in your response (e.g. "Created John Smith and linked to Acme Corp (newly created)").
- If a user mentions both a person and a company in the same request, create both entities.

Meeting follow-up workflow (CRITICAL — triggers when context contains "meeting_id"):
- You HAVE the \`link_meeting_to_contact\` tool. Use it to link a completed meeting (by meeting_id) to a contact and/or company. Never say you do not have a tool to link meetings, search meetings, or add contacts to meetings — you do.
- When the user provides post-meeting info (who it was with, company, action items), you MUST call tools — do NOT just acknowledge.
- Required sequence: (1) call \`link_meeting_to_contact\` using the meeting_id from context and the contact name/id the user gave — pass contact_name directly, no need to search first; (2) create any tasks or action items with \`create_task\`; (3) confirm everything was saved.
- If the user only mentions a company but no contact name, call \`link_meeting_to_contact\` with company_name instead of contact_name.
- Never say "I'm unable to link" or "I don't have a tool for meetings" — the tool exists. Always attempt it.

Delete workflow (CRITICAL):
- NEVER delete or archive a record without explicit confirmation from the user.
- Always search first and show the exact record (name, key details) before asking to confirm.
- Ask "Are you sure you want to delete [exact name]?" before calling any delete action.
- For deals, deletion is a soft archive — the deal is hidden but not permanently removed.

Clarification behavior:
- If a request is ambiguous or missing required context, ask ONE focused clarifying question that names the specific fields needed.
- Do NOT ask "Can you provide more details?" — instead ask "What's [Name]'s email address?" or "What's the deal value and which stage?"
- Keep clarifying questions short and specific — list only the missing fields, not every possible option.
- After getting the answer, complete the full action without asking again.`;

export const requestSchema = z.object({
  messages: z.array(z.any()),
  threadId: z.string().optional(),
  channel: z.enum(["chat", "voice", "automation", "slack"]).optional(),
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
    title: z.string().min(1).optional(),
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
export const linkMeetingToContactSchema = z
  .object({
    meeting_id: z.number().int().positive(),
    contact_id: z.number().int().positive().optional(),
    contact_name: z.string().min(1).optional(),
    company_id: z.number().int().positive().optional(),
    company_name: z.string().min(1).optional(),
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
    title: z.string().min(1).optional(),
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
        "Create a new contact. Use company_name to link to a company by name. If the company does not exist it will be created automatically — do NOT search for the company first.",
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
      description:
        "Search and list deals by deal name, company, status, or stage (stage and status mean the same thing). Use this before answering questions about a specific deal when the user gives a partial description or asks whether they should continue/pursue it.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          status: { type: "string", description: "Filter by status/stage (e.g. opportunity, in-negotiation, won, lost)" },
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
        "Create a new deal. Use company_name to link to a company by name. If the company does not exist it will be created automatically — do NOT search for the company first.",
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
        "Update an existing deal. Use when the user wants to change deal stage, status, amount, or name. Stage and status mean the same thing — use the status parameter. Use id (preferred, from a prior search) or deal_name. Call this immediately after finding the deal — do NOT search again.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "Deal ID from a prior search" },
          deal_name: { type: "string", description: "Deal name to look up" },
          name: { type: "string" },
          status: { type: "string", description: "New status/stage (stage and status mean the same thing)" },
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
      description: "Add a note to a contact (contact-only). For deals, use add_note instead. Use contact_name or contact_id.",
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
          title: { type: "string", description: "Short title or subject for the note" },
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
        "Add a note to a contact OR a deal. Use this when the note is for a deal. Use contact_name/deal_name or contact_id/deal_id. Always provide a title.",
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
          title: { type: "string", description: "Short title or subject for the note" },
          text: { type: "string", description: "The note content" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "link_meeting_to_contact",
      description:
        "Link a completed meeting to the contact (and optionally company) who attended. Always call this during a post-meeting follow-up when the user identifies who the meeting was with. Use the meeting_id from the system context. You can pass contact_name directly — no need to search first.",
      parameters: {
        type: "object",
        properties: {
          meeting_id: {
            type: "number",
            description: "The meeting ID provided in the system context",
          },
          contact_id: {
            type: "number",
            description: "Contact ID from a prior search (preferred if already known)",
          },
          contact_name: {
            type: "string",
            description: "Full name of the contact who attended the meeting",
          },
          company_id: {
            type: "number",
            description: "Company ID (optional, from a prior search)",
          },
          company_name: {
            type: "string",
            description: "Company name to also link the meeting to (optional)",
          },
        },
        required: ["meeting_id"],
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

type LookupSummaryIntent = {
  singular: "company" | "contact" | "deal" | "task";
  plural: "companies" | "contacts" | "deals" | "tasks";
  toolNames: string[];
};

const LOOKUP_SUMMARY_INTENTS: LookupSummaryIntent[] = [
  {
    singular: "company",
    plural: "companies",
    toolNames: ["search_companies", "get_company"],
  },
  {
    singular: "contact",
    plural: "contacts",
    toolNames: ["search_contacts", "get_contact"],
  },
  {
    singular: "deal",
    plural: "deals",
    toolNames: ["search_deals", "get_deal"],
  },
  {
    singular: "task",
    plural: "tasks",
    toolNames: ["search_tasks", "list_tasks"],
  },
];

function parseLookupItems(result: string): string[] {
  return result
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^tool guidance:/i.test(line))
    .map((line) => line.replace(/^(?:\d+\.|-)\s*/, "").trim())
    .filter(Boolean)
    .map((line) => cleanUserFacingText(line))
    .filter(Boolean);
}

function isMutationQuery(queryText: string): boolean {
  return /\b(create|add|make|update|rename|change|edit|set|complete|mark)\b/i.test(
    queryText,
  );
}

function isPluralEntityRequest(queryText: string, intent: LookupSummaryIntent): boolean {
  return new RegExp(`\\b${intent.plural}\\b`, "i").test(queryText);
}

function isListStyleLookupQuery(queryText: string): boolean {
  return /\b(latest|newest|most recent|recent|last|list|show|find|search|lookup)\b/i.test(
    queryText,
  );
}

export function isRecordAdviceQuery(queryText: string): boolean {
  const lower = queryText.toLowerCase();
  const hasSpecificRecordReference =
    /\b(my|the|this|that|these|those|latest|newest|most recent|last|same|it)\b/.test(lower)
    && /\b(contact|person|lead|company|organization|deal|opportunity|task|todo|note)\b/.test(
      lower,
    );
  return (
    hasSpecificRecordReference &&
    (
      /\bwhat do you think about\b/.test(lower) ||
      /\bshould (?:i|we) continue\b/.test(lower) ||
      /\bworth (?:continuing|pursuing|it)\b/.test(lower) ||
      /\b(?:healthy|good|bad|stuck|risky|viable)\b/.test(lower)
    )
  );
}

export type RecentRecordReference = {
  entity: "contact" | "company" | "deal";
  id: number;
  name: string;
};

export type ThreadEntityMemory = {
  currentFocus: RecentRecordReference | null;
  lastByEntity: Partial<Record<RecentRecordReference["entity"], RecentRecordReference>>;
  lastBatchByEntity: Partial<Record<RecentRecordReference["entity"], RecentRecordReference[]>>;
  recentMentions: RecentRecordReference[];
};

export type ThreadEntityResolution =
  | { mode: "none" }
  | { mode: "resolved"; record: RecentRecordReference }
  | {
      mode: "ambiguous";
      entity: RecentRecordReference["entity"] | null;
      candidates: RecentRecordReference[];
    };

const ENTITY_TYPES = ["contact", "company", "deal"] as const;

export function createEmptyThreadEntityMemory(): ThreadEntityMemory {
  return {
    currentFocus: null,
    lastByEntity: {},
    lastBatchByEntity: {},
    recentMentions: [],
  };
}

function dedupeRecordReferences(refs: RecentRecordReference[]): RecentRecordReference[] {
  return refs.filter((ref, index, array) =>
    array.findIndex((candidate) => candidate.entity === ref.entity && candidate.id === ref.id) === index,
  );
}

export function normalizeThreadEntityMemory(value: unknown): ThreadEntityMemory {
  if (!value || typeof value !== "object") {
    return createEmptyThreadEntityMemory();
  }

  const input = value as Record<string, unknown>;
  const parseRef = (candidate: unknown): RecentRecordReference | null => {
    if (!candidate || typeof candidate !== "object") return null;
    const record = candidate as Record<string, unknown>;
    if (
      (record.entity === "contact" || record.entity === "company" || record.entity === "deal")
      && typeof record.id === "number"
      && Number.isFinite(record.id)
      && typeof record.name === "string"
      && record.name.trim()
    ) {
      return {
        entity: record.entity,
        id: record.id,
        name: cleanUserFacingText(record.name),
      };
    }
    return null;
  };

  const lastByEntity = Object.fromEntries(
    ENTITY_TYPES.flatMap((entity) => {
      const parsed = parseRef((input.lastByEntity as Record<string, unknown> | undefined)?.[entity]);
      return parsed ? [[entity, parsed]] : [];
    }),
  ) as ThreadEntityMemory["lastByEntity"];

  const lastBatchByEntity = Object.fromEntries(
    ENTITY_TYPES.flatMap((entity) => {
      const batchRaw = (input.lastBatchByEntity as Record<string, unknown> | undefined)?.[entity];
      const batch = Array.isArray(batchRaw)
        ? dedupeRecordReferences(batchRaw.map((item) => parseRef(item)).filter(Boolean) as RecentRecordReference[]).slice(0, 5)
        : [];
      return batch.length > 0 ? [[entity, batch]] : [];
    }),
  ) as ThreadEntityMemory["lastBatchByEntity"];

  const currentFocus = parseRef(input.currentFocus);
  const recentMentions = Array.isArray(input.recentMentions)
    ? dedupeRecordReferences(
      input.recentMentions
        .map((item) => parseRef(item))
        .filter(Boolean) as RecentRecordReference[],
    ).slice(0, 12)
    : [];

  return {
    currentFocus,
    lastByEntity,
    lastBatchByEntity,
    recentMentions,
  };
}

function slugToEntity(slug: string): RecentRecordReference["entity"] | null {
  if (slug === "contacts") return "contact";
  if (slug === "companies") return "company";
  if (slug === "deals") return "deal";
  return null;
}

function inferEntityHint(queryText: string): RecentRecordReference["entity"] | null {
  const lower = queryText.toLowerCase();
  if (/\b(deal|deals|opportunity|opportunities)\b/.test(lower)) return "deal";
  if (/\b(company|companies|organization|organizations)\b/.test(lower)) return "company";
  if (/\b(contact|contacts|person|people|lead|leads)\b/.test(lower)) return "contact";
  return null;
}

export function extractRecordReferences(text: string): RecentRecordReference[] {
  const links: RecentRecordReference[] = [];

  for (const match of text.matchAll(/\[([^\]]+)\]\(\/objects\/(contacts|companies|deals)\/(\d+)(?:#[^)]+)?\)/g)) {
    const entity = slugToEntity(match[2] ?? "");
    const id = Number(match[3]);
    const name = cleanUserFacingText(match[1] ?? "");
    if (entity && Number.isFinite(id) && name) {
      links.push({ entity, id, name });
    }
  }

  for (const match of text.matchAll(/\[\[(contacts|companies|deals)\/(\d+)(?:#[^\]|]+)?\|([^\]]+)\]\]/g)) {
    const entity = slugToEntity(match[1] ?? "");
    const id = Number(match[2]);
    const name = cleanUserFacingText(match[3] ?? "");
    if (entity && Number.isFinite(id) && name) {
      links.push({ entity, id, name });
    }
  }

  return dedupeRecordReferences(links);
}

export function updateThreadEntityMemory(
  memory: ThreadEntityMemory,
  refs: RecentRecordReference[],
): ThreadEntityMemory {
  const dedupedRefs = dedupeRecordReferences(refs);
  if (dedupedRefs.length === 0) {
    return memory;
  }

  const nextLastByEntity = { ...memory.lastByEntity };
  const nextLastBatchByEntity = { ...memory.lastBatchByEntity };

  for (const entity of ENTITY_TYPES) {
    const entityRefs = dedupedRefs.filter((ref) => ref.entity === entity);
    if (entityRefs.length === 0) continue;

    nextLastBatchByEntity[entity] = entityRefs.slice(0, 5);
    if (entityRefs.length === 1) {
      nextLastByEntity[entity] = entityRefs[0]!;
    } else {
      delete nextLastByEntity[entity];
    }
  }

  return {
    currentFocus: dedupedRefs.length === 1 ? dedupedRefs[0]! : null,
    lastByEntity: nextLastByEntity,
    lastBatchByEntity: nextLastBatchByEntity,
    recentMentions: [
      ...dedupedRefs,
      ...memory.recentMentions.filter((existing) =>
        !dedupedRefs.some((incoming) =>
          incoming.entity === existing.entity && incoming.id === existing.id
        ),
      ),
    ].slice(0, 12),
  };
}

function isFollowUpReferenceQuery(queryText: string): boolean {
  return /\b(it|this|that|the|same)\b/i.test(queryText);
}

export function resolveThreadEntityReference(
  queryText: string,
  memory: ThreadEntityMemory,
): ThreadEntityResolution {
  const entityHint = inferEntityHint(queryText);
  const mentionsFollowUp = isFollowUpReferenceQuery(queryText) || entityHint !== null;
  if (!mentionsFollowUp) {
    return { mode: "none" };
  }

  if (entityHint) {
    const batch = memory.lastBatchByEntity[entityHint];
    if (batch?.length === 1) {
      return { mode: "resolved", record: batch[0]! };
    }
    if (batch && batch.length > 1) {
      return { mode: "ambiguous", entity: entityHint, candidates: batch };
    }

    const last = memory.lastByEntity[entityHint];
    if (last) {
      return { mode: "resolved", record: last };
    }

    const matchingMentions = dedupeRecordReferences(
      memory.recentMentions.filter((ref) => ref.entity === entityHint),
    );
    if (matchingMentions.length === 1) {
      return { mode: "resolved", record: matchingMentions[0]! };
    }
    if (matchingMentions.length > 1) {
      return {
        mode: "ambiguous",
        entity: entityHint,
        candidates: matchingMentions.slice(0, 5),
      };
    }
    return { mode: "none" };
  }

  if (memory.currentFocus) {
    return { mode: "resolved", record: memory.currentFocus };
  }

  if (memory.recentMentions.length === 1) {
    return { mode: "resolved", record: memory.recentMentions[0]! };
  }
  if (memory.recentMentions.length > 1) {
    return {
      mode: "ambiguous",
      entity: null,
      candidates: memory.recentMentions.slice(0, 5),
    };
  }

  return { mode: "none" };
}

function deriveLookupAnswer(
  queryText: string,
  toolOutputs: Array<{ name: string; result: unknown }>,
): string {
  if (isMutationQuery(queryText)) {
    return "";
  }

  const latestLookup = [...toolOutputs]
    .reverse()
    .find(
      (output): output is { name: string; result: string } =>
        typeof output.result === "string"
        && LOOKUP_SUMMARY_INTENTS.some((intent) => intent.toolNames.includes(output.name)),
    );
  if (!latestLookup) {
    return "";
  }

  const intent = LOOKUP_SUMMARY_INTENTS.find((entry) =>
    entry.toolNames.includes(latestLookup.name),
  );
  if (!intent) {
    return "";
  }

  const cleanedResult = cleanUserFacingText(latestLookup.result).trim();
  if (!cleanedResult) {
    return "";
  }
  if (/^(No .* found\.?|Not found\.?|Error:)/i.test(cleanedResult)) {
    return cleanedResult;
  }

  if (latestLookup.name.startsWith("get_") && !isRecordAdviceQuery(queryText)) {
    return cleanedResult;
  }

  const items = parseLookupItems(latestLookup.result);
  if (items.length === 0) {
    return cleanedResult;
  }

  const rankedIntent = detectRankedEntityIntent(queryText);
  if (
    rankedIntent
    && rankedIntent.label === intent.singular
    && !isPluralEntityRequest(queryText, intent)
  ) {
    const selected = items[rankedIntent.rank - 1];
    return selected
      ? `Your ${rankedIntent.rankLabel} ${intent.singular} is ${selected}.`
      : `I couldn't find a ${rankedIntent.rankLabel} ${intent.singular}.`;
  }

  if (isListStyleLookupQuery(queryText) || isPluralEntityRequest(queryText, intent)) {
    const heading = /\b(latest|newest|most recent|recent|last)\b/i.test(queryText)
      ? `Here are your latest ${intent.plural}:`
      : `Here are the matching ${intent.plural}:`;
    return `${heading}\n${items.slice(0, 5).map((item) => `- ${item}`).join("\n")}`;
  }

  if (isRecordAdviceQuery(queryText)) {
    return "";
  }

  return cleanedResult;
}

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

function _extractLinkedRecords(
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

  return deriveLookupAnswer(queryText, toolOutputs);
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
