/**
 * Stream assistant - CRM-aware AI for the voice pill overlay.
 * POST /stream/assistant { message, history } -> SSE data: {token}, data: [DONE]
 */

import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import type { createAuth } from "../auth.js";
import { buildCrmSummary, retrieveRelevantContext } from "../lib/context.js";
import { resolveCrmUserWithApiKey } from "../lib/crm-user-auth.js";
import { ASSISTANT_TOOLS, executeAssistantToolDrizzle } from "../assistant/tools.js";
import { PERMISSIONS, requirePermission } from "../lib/rbac.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

const ASSISTANT_SYSTEM_PROMPT =
  "You are Basics OS Company Assistant - an AI grounded in this company's data. Answer questions based on the context provided. Be concise and helpful.";

export function createStreamAssistantRoutes(
  db: Db,
  auth: BetterAuthInstance,
  env: Env
) {
  const app = new Hono();

  app.post("/assistant", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const crmUserAuth = await resolveCrmUserWithApiKey(c, db);
    if (!crmUserAuth.ok) return crmUserAuth.response;
    const { crmUser, apiKey } = crmUserAuth.data;
    if (!crmUser.organizationId) return c.json({ error: "Organization not found" }, 404);

    let body: { message?: string; history?: Array<{ role: string; content: string }> };
    try {
      body = (await c.req.json()) as {
        message?: string;
        history?: Array<{ role: string; content: string }>;
      };
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const message = body.message?.trim() ?? "";
    if (!message) {
      return c.json({ error: "message is required" }, 400);
    }

    const history = (body.history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const [crmSummary, ragContext] = await Promise.all([
      buildCrmSummary(db, crmUser.organizationId),
      retrieveRelevantContext(db, env.BASICOS_API_URL, apiKey, crmUser.organizationId, message),
    ]);

    let contextText = `## Your CRM\n${crmSummary}`;
    if (ragContext) {
      contextText += `\n\n## Relevant context\n${ragContext}`;
    }

    const systemContent = `${ASSISTANT_SYSTEM_PROMPT}\n\n${contextText}`;
    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemContent },
      ...history,
      { role: "user", content: message },
    ];

    let finalContent = "";
    const maxIterations = 5;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let toolCallRes: Response;
      try {
        toolCallRes = await fetch(`${env.BASICOS_API_URL}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "basics-chat-smart",
            messages: chatMessages,
            tools: ASSISTANT_TOOLS,
            tool_choice: "auto",
            stream: false,
          }),
        });
      } catch (err) {
        console.error("[stream-assistant] fetch error:", err);
        return c.json({ error: "Failed to reach AI gateway" }, 502);
      }

      if (!toolCallRes.ok) {
        const errText = await toolCallRes.text().catch(() => "");
        console.error(
          "[stream-assistant] gateway error:",
          toolCallRes.status,
          errText
        );
        return c.json({ error: "Gateway error" }, 502);
      }

      const json = (await toolCallRes.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              type: "function";
              function: { name: string; arguments: string };
            }>;
          };
        }>;
      };

      const aiMessage = json.choices?.[0]?.message;
      const toolCalls = aiMessage?.tool_calls ?? [];

      if (toolCalls.length === 0) {
        finalContent = aiMessage?.content ?? "";
        break;
      }

      chatMessages.push({
        role: "assistant",
        content: aiMessage?.content ?? null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          // malformed tool args are treated as empty object
        }

        const result = await executeAssistantToolDrizzle(
          db,
          crmUser.id,
          crmUser.organizationId,
          tc.function.name,
          args
        );

        chatMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
    }

    if (!finalContent) {
      finalContent = "I could not complete that action yet. Please try again.";
    }

    const encoder = new TextEncoder();
    const outStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ token: finalContent })}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(outStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });

  return app;
}
