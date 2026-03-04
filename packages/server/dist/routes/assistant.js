import { Hono } from "hono";
import * as schema from "../db/schema/index.js";
import { eq, sql } from "drizzle-orm";
import { ASSISTANT_TOOLS, executeAssistantToolDrizzle } from "../assistant/tools.js";
import { assistantSchema } from "@basics-os/shared/schemas";
export function createAssistantRoutes(db, auth, env) {
    const app = new Hono();
    app.post("/", async (c) => {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session?.user) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({ error: "Invalid JSON body" }, 400);
        }
        const parsed = assistantSchema.safeParse(body);
        if (!parsed.success) {
            return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
        }
        const { message, messages: history = [] } = parsed.data;
        const crmUserRows = await db
            .select()
            .from(schema.crmUsers)
            .where(eq(schema.crmUsers.userId, session.user.id))
            .limit(1);
        const crmUser = crmUserRows[0];
        if (!crmUser) {
            return c.json({ error: "User not found in CRM" }, 404);
        }
        if (!crmUser.basicsApiKey) {
            return c.json({
                error: "Basics API key not configured. Add your key in Settings.",
            }, 400);
        }
        const crmUserInfo = { crmUserId: crmUser.id, apiKey: crmUser.basicsApiKey };
        if (!crmUser.organizationId) {
            return c.json({ error: "Organization not found" }, 404);
        }
        const queryEmbedding = await embedQuery(env.BASICOS_API_URL, crmUserInfo.apiKey, message);
        if (!queryEmbedding) {
            return c.json({ error: "Failed to embed query" }, 502);
        }
        const chunks = await similaritySearch(db, crmUserInfo.crmUserId, queryEmbedding, 5);
        const contextText = chunks.length > 0
            ? chunks.map((ch) => ch.chunk_text).join("\n\n---\n\n")
            : "(No relevant context found in your CRM.)";
        const systemPrompt = `You are an AI assistant for a CRM. Answer the user's question using the following context from their CRM when relevant. If the context doesn't contain relevant information, say so.

You have access to tools: create_task (add a task for a contact), add_note (add a note to a contact or deal), update_deal (update a deal's stage). Use these when the user asks you to perform actions like "create a task for John" or "add a note to this deal". When using tools, you must have the correct entity IDs from the context.

Context from CRM:
${contextText}`;
        let chatMessages = [
            { role: "system", content: systemPrompt },
            ...history.map((m) => ({
                role: m.role,
                content: m.content,
            })),
            { role: "user", content: message },
        ];
        let finalContent = "";
        let iterations = 0;
        const maxIterations = 5;
        while (iterations < maxIterations) {
            iterations++;
            const res = await fetch(`${env.BASICOS_API_URL}/v1/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${crmUserInfo.apiKey}`,
                },
                body: JSON.stringify({
                    model: "basics-chat-smart",
                    messages: chatMessages,
                    tools: ASSISTANT_TOOLS,
                    stream: false,
                }),
            });
            if (!res.ok) {
                const errText = await res.text();
                console.error("[assistant] basicsAdmin error:", res.status, errText);
                return c.json({ error: "AI service error", details: errText.slice(0, 200) }, 502);
            }
            const json = (await res.json());
            const choice = json.choices?.[0];
            const msg = choice?.message;
            const toolCalls = msg?.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
                chatMessages.push({
                    role: "assistant",
                    content: msg?.content ?? null,
                    tool_calls: toolCalls,
                });
                for (const tc of toolCalls) {
                    let args = {};
                    try {
                        args = JSON.parse(tc.function.arguments || "{}");
                    }
                    catch {
                        /* ignore */
                    }
                    const result = await executeAssistantToolDrizzle(db, crmUserInfo.crmUserId, crmUser.organizationId, tc.function.name, args);
                    chatMessages.push({
                        role: "tool",
                        tool_call_id: tc.id,
                        content: result,
                    });
                }
                continue;
            }
            finalContent = msg?.content ?? "";
            break;
        }
        return new Response(createStreamChunk(finalContent), {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    });
    return app;
}
function createStreamChunk(content) {
    const data = JSON.stringify({
        id: "chatcmpl-" + Date.now(),
        choices: [{ delta: { content }, index: 0 }],
    });
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
        },
    });
}
async function similaritySearch(db, crmUserId, queryEmbedding, limit) {
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const result = await db.execute(sql `
    select entity_type, entity_id, chunk_text
    from match_context_embeddings(${crmUserId}, ${embeddingStr}::vector, ${limit})
  `);
    const rows = Array.isArray(result) ? result : result.rows ?? [];
    return rows;
}
async function embedQuery(basicosApiUrl, apiKey, text) {
    const res = await fetch(`${basicosApiUrl}/v1/embeddings`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "text-embedding-3-small",
            input: text,
        }),
    });
    if (!res.ok)
        return null;
    const json = (await res.json());
    const embedding = json.data?.[0]?.embedding;
    return embedding ?? null;
}
