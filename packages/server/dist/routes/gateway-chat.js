import { Hono } from "hono";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import * as schema from "../db/schema/index.js";
import { buildCrmSummary, retrieveRelevantContext } from "../lib/context.js";
import { resolveCrmUserWithApiKey } from "../lib/crm-user-auth.js";
import { PERMISSIONS, requirePermission } from "../lib/rbac.js";
const BASE_SYSTEM_PROMPT = "You are an AI assistant for a CRM. Help the user manage contacts, deals, companies, tasks, and notes. Be concise and helpful. Always use tools for specific record lookups or mutations.";
const requestSchema = z.object({
    messages: z.array(z.any()),
    threadId: z.string().optional(),
    channel: z.enum(["chat", "voice", "automation"]).optional(),
});
const searchContactsSchema = z.object({
    query: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
});
const getContactSchema = z.object({ id: z.number().int().positive() });
const createContactSchema = z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email().optional(),
    status: z.string().optional(),
    company_id: z.number().int().positive().optional(),
});
const updateContactSchema = z
    .object({
    id: z.number().int().positive(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email().optional(),
    status: z.string().optional(),
})
    .superRefine((v, ctx) => {
    if (v.first_name === undefined && v.last_name === undefined && v.email === undefined && v.status === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one field is required" });
    }
});
const searchDealsSchema = z.object({
    query: z.string().optional(),
    stage: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
});
const getDealSchema = z.object({ id: z.number().int().positive() });
const createDealSchema = z.object({
    name: z.string().min(1),
    stage: z.string().optional(),
    category: z.string().optional(),
    company_id: z.number().int().positive().optional(),
    amount: z.number().optional(),
    description: z.string().optional(),
});
const updateDealSchema = z
    .object({
    id: z.number().int().positive(),
    name: z.string().optional(),
    stage: z.string().optional(),
    category: z.string().optional(),
    amount: z.number().optional(),
    description: z.string().optional(),
})
    .superRefine((v, ctx) => {
    if (v.name === undefined && v.stage === undefined && v.category === undefined && v.amount === undefined && v.description === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one field is required" });
    }
});
const searchCompaniesSchema = z.object({
    query: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
});
const createCompanySchema = z.object({
    name: z.string().min(1),
    sector: z.string().optional(),
    city: z.string().optional(),
    website: z.string().optional(),
});
const listTasksSchema = z.object({
    contact_id: z.number().int().positive(),
    limit: z.number().int().min(1).max(100).optional(),
});
const createTaskSchema = z.object({
    contact_id: z.number().int().positive(),
    text: z.string().min(1),
    type: z.string().optional(),
    due_date: z.string().optional(),
});
const completeTaskSchema = z.object({ id: z.number().int().positive() });
const listNotesSchema = z.object({
    contact_id: z.number().int().positive(),
    limit: z.number().int().min(1).max(100).optional(),
});
const createNoteSchema = z.object({
    contact_id: z.number().int().positive(),
    text: z.string().min(1),
    type: z.string().optional(),
});
const OPENAI_TOOL_DEFS = [
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
            parameters: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
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
                    status: { type: "string" },
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
                    status: { type: "string" },
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
                    stage: { type: "string" },
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
            parameters: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
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
                    stage: { type: "string" },
                    category: { type: "string" },
                    company_id: { type: "number" },
                    amount: { type: "number" },
                    description: { type: "string" },
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
                    stage: { type: "string" },
                    category: { type: "string" },
                    amount: { type: "number" },
                    description: { type: "string" },
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
                    sector: { type: "string" },
                    city: { type: "string" },
                    website: { type: "string" },
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
                properties: { contact_id: { type: "number" }, limit: { type: "number" } },
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
            parameters: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
        },
    },
    {
        type: "function",
        function: {
            name: "list_notes",
            description: "List notes for a contact.",
            parameters: {
                type: "object",
                properties: { contact_id: { type: "number" }, limit: { type: "number" } },
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
];
const limitFrom = (n) => {
    if (typeof n !== "number" || !Number.isFinite(n))
        return 25;
    return Math.max(1, Math.min(100, Math.trunc(n)));
};
const sdkPart = (code, value) => `${code}:${JSON.stringify(value)}\n`;
const toolFallbackText = (toolOutputs) => {
    if (toolOutputs.length === 0)
        return "I could not complete that request. Please try again.";
    const preview = toolOutputs
        .slice(0, 3)
        .map((t) => `${t.name}: ${JSON.stringify(t.result).slice(0, 700)}`)
        .join("\n\n");
    return `I completed the requested CRM tool action(s), but the model could not finish the final phrasing step. Here are the grounded results:\n\n${preview}`;
};
function uiMessageText(msg) {
    if (typeof msg.content === "string")
        return msg.content;
    return (msg.parts ?? [])
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("");
}
function toOpenAIMessages(uiMessages) {
    const out = [];
    for (const raw of uiMessages) {
        const msg = raw;
        if (msg.role !== "user" && msg.role !== "assistant")
            continue;
        const text = uiMessageText(msg).trim();
        if (!text)
            continue;
        out.push({ role: msg.role, content: text });
    }
    return out;
}
async function ensureThread(db, crmUser, threadIdRaw, channelRaw) {
    if (!crmUser.organizationId)
        throw new Error("Organization not found");
    const channel = channelRaw === "voice" || channelRaw === "automation" ? channelRaw : "chat";
    if (threadIdRaw?.trim()) {
        const id = threadIdRaw.trim();
        const existing = await db
            .select({ id: schema.aiThreads.id })
            .from(schema.aiThreads)
            .where(and(eq(schema.aiThreads.id, id), eq(schema.aiThreads.crmUserId, crmUser.id)))
            .limit(1);
        if (existing[0])
            return id;
    }
    const [inserted] = await db
        .insert(schema.aiThreads)
        .values({ crmUserId: crmUser.id, organizationId: crmUser.organizationId, channel })
        .returning({ id: schema.aiThreads.id });
    if (!inserted)
        throw new Error("Failed to create thread");
    return inserted.id;
}
async function persistMessage(db, threadId, role, content, opts) {
    await db.insert(schema.aiMessages).values({
        threadId,
        role,
        content,
        toolName: opts?.toolName ?? null,
        toolArgs: opts?.toolArgs ?? null,
        toolResult: opts?.toolResult ?? null,
    });
}
async function executeValidatedTool(db, crmUserId, organizationId, toolName, rawArgs) {
    const contactExists = async (contactId) => {
        const rows = await db
            .select({ id: schema.contacts.id })
            .from(schema.contacts)
            .where(and(eq(schema.contacts.id, contactId), eq(schema.contacts.organizationId, organizationId)))
            .limit(1);
        return Boolean(rows[0]);
    };
    if (toolName === "search_contacts") {
        const parsed = searchContactsSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        const query = args.query?.trim() ?? "";
        const conditions = [eq(schema.contacts.organizationId, organizationId)];
        if (query) {
            conditions.push(or(ilike(schema.contacts.firstName, `%${query}%`), ilike(schema.contacts.lastName, `%${query}%`), ilike(schema.contacts.email, `%${query}%`)));
        }
        return db.select().from(schema.contacts).where(and(...conditions)).limit(limitFrom(args.limit));
    }
    if (toolName === "get_contact") {
        const parsed = getContactSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const rows = await db
            .select()
            .from(schema.contacts)
            .where(and(eq(schema.contacts.id, parsed.data.id), eq(schema.contacts.organizationId, organizationId)))
            .limit(1);
        return rows[0] ?? null;
    }
    if (toolName === "create_contact") {
        const parsed = createContactSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        const [row] = await db
            .insert(schema.contacts)
            .values({
            crmUserId,
            organizationId,
            firstName: args.first_name ?? null,
            lastName: args.last_name ?? null,
            email: args.email ?? null,
            status: args.status ?? null,
            companyId: args.company_id ?? null,
        })
            .returning();
        return row ?? { error: "failed to create contact" };
    }
    if (toolName === "update_contact") {
        const parsed = updateContactSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        const updates = {};
        if (args.first_name !== undefined)
            updates.firstName = args.first_name;
        if (args.last_name !== undefined)
            updates.lastName = args.last_name;
        if (args.email !== undefined)
            updates.email = args.email;
        if (args.status !== undefined)
            updates.status = args.status;
        const [row] = await db
            .update(schema.contacts)
            .set(updates)
            .where(and(eq(schema.contacts.id, args.id), eq(schema.contacts.organizationId, organizationId)))
            .returning();
        return row ?? { error: "contact not found" };
    }
    if (toolName === "search_deals") {
        const parsed = searchDealsSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        const query = args.query?.trim() ?? "";
        const conditions = [eq(schema.deals.organizationId, organizationId), isNull(schema.deals.archivedAt)];
        if (query)
            conditions.push(ilike(schema.deals.name, `%${query}%`));
        if (args.stage)
            conditions.push(eq(schema.deals.stage, args.stage));
        return db.select().from(schema.deals).where(and(...conditions)).limit(limitFrom(args.limit));
    }
    if (toolName === "get_deal") {
        const parsed = getDealSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const rows = await db
            .select()
            .from(schema.deals)
            .where(and(eq(schema.deals.id, parsed.data.id), eq(schema.deals.organizationId, organizationId), isNull(schema.deals.archivedAt)))
            .limit(1);
        return rows[0] ?? null;
    }
    if (toolName === "create_deal") {
        const parsed = createDealSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        const [row] = await db
            .insert(schema.deals)
            .values({
            crmUserId,
            organizationId,
            name: args.name.trim(),
            stage: args.stage ?? "qualification",
            category: args.category ?? null,
            companyId: args.company_id ?? null,
            amount: args.amount ?? null,
            description: args.description ?? null,
        })
            .returning();
        return row ?? { error: "failed to create deal" };
    }
    if (toolName === "update_deal") {
        const parsed = updateDealSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        const updates = { updatedAt: new Date() };
        if (args.name !== undefined)
            updates.name = args.name;
        if (args.stage !== undefined)
            updates.stage = args.stage;
        if (args.category !== undefined)
            updates.category = args.category;
        if (args.amount !== undefined)
            updates.amount = args.amount;
        if (args.description !== undefined)
            updates.description = args.description;
        const [row] = await db
            .update(schema.deals)
            .set(updates)
            .where(and(eq(schema.deals.id, args.id), eq(schema.deals.organizationId, organizationId), isNull(schema.deals.archivedAt)))
            .returning();
        return row ?? { error: "deal not found" };
    }
    if (toolName === "search_companies") {
        const parsed = searchCompaniesSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        const query = args.query?.trim() ?? "";
        const conditions = [eq(schema.companies.organizationId, organizationId)];
        if (query) {
            conditions.push(or(ilike(schema.companies.name, `%${query}%`), ilike(schema.companies.city, `%${query}%`), ilike(schema.companies.sector, `%${query}%`)));
        }
        return db.select().from(schema.companies).where(and(...conditions)).limit(limitFrom(args.limit));
    }
    if (toolName === "create_company") {
        const parsed = createCompanySchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        const [row] = await db
            .insert(schema.companies)
            .values({
            crmUserId,
            organizationId,
            name: args.name.trim(),
            sector: args.sector ?? null,
            city: args.city ?? null,
            website: args.website ?? null,
        })
            .returning();
        return row ?? { error: "failed to create company" };
    }
    if (toolName === "list_tasks") {
        const parsed = listTasksSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        return db
            .select()
            .from(schema.tasks)
            .where(and(eq(schema.tasks.organizationId, organizationId), eq(schema.tasks.contactId, args.contact_id)))
            .orderBy(desc(schema.tasks.id))
            .limit(limitFrom(args.limit));
    }
    if (toolName === "create_task") {
        const parsed = createTaskSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        if (!(await contactExists(args.contact_id)))
            return { error: "contact not found" };
        let dueDate = null;
        if (args.due_date) {
            const parsedDate = new Date(args.due_date);
            if (!Number.isNaN(parsedDate.getTime()))
                dueDate = parsedDate;
        }
        const [row] = await db
            .insert(schema.tasks)
            .values({
            crmUserId,
            organizationId,
            contactId: args.contact_id,
            text: args.text.trim(),
            type: args.type ?? "call",
            dueDate,
        })
            .returning();
        return row ?? { error: "failed to create task" };
    }
    if (toolName === "complete_task") {
        const parsed = completeTaskSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const [row] = await db
            .update(schema.tasks)
            .set({ doneDate: new Date() })
            .where(and(eq(schema.tasks.id, parsed.data.id), eq(schema.tasks.organizationId, organizationId)))
            .returning();
        return row ?? { error: "task not found" };
    }
    if (toolName === "list_notes") {
        const parsed = listNotesSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        return db
            .select()
            .from(schema.contactNotes)
            .where(and(eq(schema.contactNotes.organizationId, organizationId), eq(schema.contactNotes.contactId, args.contact_id)))
            .orderBy(desc(schema.contactNotes.id))
            .limit(limitFrom(args.limit));
    }
    if (toolName === "create_note") {
        const parsed = createNoteSchema.safeParse(rawArgs);
        if (!parsed.success)
            return { error: "Invalid arguments", details: parsed.error.flatten() };
        const args = parsed.data;
        if (!(await contactExists(args.contact_id)))
            return { error: "contact not found" };
        const [row] = await db
            .insert(schema.contactNotes)
            .values({
            crmUserId,
            organizationId,
            contactId: args.contact_id,
            text: args.text.trim(),
            status: args.type ?? null,
        })
            .returning();
        return row ?? { error: "failed to create note" };
    }
    return { error: `Unknown tool: ${toolName}` };
}
export function createGatewayChatRoutes(db, auth, env) {
    const app = new Hono();
    app.post("/", authMiddleware(auth, db), async (c) => {
        const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
        if (!authz.ok)
            return authz.response;
        const crmUserAuth = await resolveCrmUserWithApiKey(c, db);
        if (!crmUserAuth.ok)
            return crmUserAuth.response;
        const { crmUser, apiKey } = crmUserAuth.data;
        if (!crmUser.organizationId)
            return c.json({ error: "Organization not found" }, 404);
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({ error: "Invalid JSON body" }, 400);
        }
        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
            return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
        }
        const uiMessages = parsed.data.messages;
        const openAIMessages = toOpenAIMessages(uiMessages);
        const lastUser = [...openAIMessages].reverse().find((m) => m.role === "user");
        const queryText = lastUser?.content?.trim() ?? "";
        if (!queryText)
            return c.json({ error: "No user message found" }, 400);
        const threadId = await ensureThread(db, crmUser, parsed.data.threadId, parsed.data.channel);
        await persistMessage(db, threadId, "user", queryText);
        const [crmSummary, ragContext] = await Promise.all([
            buildCrmSummary(db, crmUser.organizationId),
            retrieveRelevantContext(db, env.BASICOS_API_URL, apiKey, crmUser.organizationId, queryText),
        ]);
        let systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n## Your CRM\n${crmSummary}`;
        if (ragContext)
            systemPrompt += `\n\n## Relevant context\n${ragContext}`;
        const chatMessages = [{ role: "system", content: systemPrompt }, ...openAIMessages];
        const usedTools = new Set();
        let finalContent = "";
        const latestToolOutputs = [];
        for (let i = 0; i < 5; i++) {
            let res;
            try {
                res = await fetch(`${env.BASICOS_API_URL}/v1/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: "basics-chat-smart",
                        messages: chatMessages,
                        tools: OPENAI_TOOL_DEFS,
                        tool_choice: "auto",
                        stream: false,
                    }),
                });
            }
            catch (err) {
                console.error("[gateway-chat] fetch error:", err);
                return c.json({ error: "Failed to reach AI gateway" }, 502);
            }
            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                console.error("[gateway-chat] gateway error:", res.status, errText);
                if (latestToolOutputs.length > 0) {
                    finalContent = toolFallbackText(latestToolOutputs);
                    break;
                }
                return c.json({ error: `Gateway error ${res.status}`, details: errText.slice(0, 400) }, 502);
            }
            const json = (await res.json());
            const aiMessage = json.choices?.[0]?.message;
            const toolCalls = aiMessage?.tool_calls ?? [];
            if (toolCalls.length === 0) {
                finalContent = (aiMessage?.content ?? "").trim();
                break;
            }
            chatMessages.push({
                role: "assistant",
                content: aiMessage?.content ?? "",
                tool_calls: toolCalls,
            });
            for (const tc of toolCalls) {
                let args = {};
                try {
                    args = JSON.parse(tc.function.arguments || "{}");
                }
                catch {
                    args = {};
                }
                const result = await executeValidatedTool(db, crmUser.id, crmUser.organizationId, tc.function.name, args);
                usedTools.add(tc.function.name);
                latestToolOutputs.push({ name: tc.function.name, result });
                await persistMessage(db, threadId, "tool", JSON.stringify(result), {
                    toolName: tc.function.name,
                    toolArgs: args,
                    toolResult: result,
                });
                chatMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify(result),
                });
            }
        }
        if (!finalContent)
            finalContent = "I could not complete that request. Please try again.";
        await persistMessage(db, threadId, "assistant", finalContent);
        const encoder = new TextEncoder();
        const parts = finalContent.match(/.{1,140}/g) ?? [finalContent];
        const outStream = new ReadableStream({
            start(controller) {
                for (const part of parts)
                    controller.enqueue(encoder.encode(sdkPart("0", part)));
                controller.enqueue(encoder.encode(sdkPart("d", { finishReason: "stop" })));
                controller.close();
            },
        });
        return new Response(outStream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "X-Vercel-AI-Data-Stream": "v1",
                "Cache-Control": "no-cache",
                "X-Thread-Id": threadId,
                "X-Tools-Used": Array.from(usedTools).join(","),
                "Access-Control-Expose-Headers": "X-Thread-Id, X-Tools-Used",
            },
        });
    });
    return app;
}
