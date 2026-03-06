import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import { buildCrmSummary, retrieveRelevantContext } from "@/lib/context.js";
import { resolveOrgAiConfig } from "@/lib/org-ai-config.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import {
  BASE_SYSTEM_PROMPT,
  OPENAI_TOOL_DEFS,
  type ChatMessage,
  requestSchema,
  sdkPart,
  toolFallbackText,
  toOpenAIMessages,
} from "@/routes/gateway-chat/protocol.js";
import {
  ensureThread,
  persistMessage,
  updateThreadTitle,
  touchThread,
} from "@/routes/gateway-chat/storage.js";
import { executeValidatedTool } from "@/routes/gateway-chat/tools.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

export function createGatewayChatRoutes(
  db: Db,
  auth: BetterAuthInstance,
  env: Env,
) {
  const app = new Hono();

  app.post("/", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const orgAi = await resolveOrgAiConfig(c, db, env);
    if (!orgAi.ok) return orgAi.response;
    const { crmUser, aiConfig } = orgAi.data;
    const apiKey = aiConfig.apiKey;
    if (!crmUser.organizationId)
      return c.json({ error: "Organization not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        400,
      );
    }

    const uiMessages = parsed.data.messages;
    const openAIMessages = toOpenAIMessages(uiMessages);
    const lastUser = [...openAIMessages]
      .reverse()
      .find((m) => m.role === "user") as
      | { role: "user"; content: string }
      | undefined;
    const queryText = lastUser?.content?.trim() ?? "";
    if (!queryText) return c.json({ error: "No user message found" }, 400);

    const threadId = await ensureThread(
      db,
      crmUser,
      parsed.data.threadId,
      parsed.data.channel,
    );
    await persistMessage(db, threadId, "user", queryText);

    // Auto-title thread: immediate fallback, then async smart title via LLM
    if (!parsed.data.threadId?.trim()) {
      const fallback =
        queryText.length > 80 ? queryText.slice(0, 77) + "..." : queryText;
      await updateThreadTitle(db, threadId, fallback);

      // Fire-and-forget: generate a 2-4 word summary title
      generateSmartTitle(
        db,
        threadId,
        queryText,
        apiKey,
        env.BASICSOS_API_URL,
      ).catch(() => {});
    }

    const [crmSummary, ragContext] = await Promise.all([
      buildCrmSummary(db, crmUser.organizationId),
      retrieveRelevantContext(
        db,
        env.BASICSOS_API_URL,
        apiKey,
        crmUser.organizationId,
        queryText,
      ),
    ]);

    let systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n## Your CRM\n${crmSummary}`;
    if (ragContext) systemPrompt += `\n\n## Relevant context\n${ragContext}`;

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...openAIMessages,
    ];
    const usedTools = new Set<string>();
    let finalContent = "";
    const latestToolOutputs: Array<{ name: string; result: unknown }> = [];

    for (let i = 0; i < 5; i++) {
      let res: Response;
      try {
        res = await fetch(`${env.BASICSOS_API_URL}/v1/chat/completions`, {
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
      } catch (err) {
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
        return c.json(
          {
            error: `Gateway error ${res.status}`,
            details: errText.slice(0, 400),
          },
          502,
        );
      }

      const json = (await res.json()) as {
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
        finalContent = (aiMessage?.content ?? "").trim();
        break;
      }

      chatMessages.push({
        role: "assistant",
        content: aiMessage?.content ?? "",
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          args = {};
        }

        const result = await executeValidatedTool(
          db,
          crmUser.id,
          crmUser.organizationId,
          tc.function.name,
          args,
        );
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
    await touchThread(db, threadId);

    const encoder = new TextEncoder();
    const parts = finalContent.match(/.{1,140}/g) ?? [finalContent];
    const outStream = new ReadableStream({
      start(controller) {
        for (const part of parts)
          controller.enqueue(encoder.encode(sdkPart("0", part)));
        controller.enqueue(
          encoder.encode(sdkPart("d", { finishReason: "stop" })),
        );
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

async function generateSmartTitle(
  db: Db,
  threadId: string,
  queryText: string,
  apiKey: string,
  gatewayUrl: string,
): Promise<void> {
  const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "basics-chat-smart",
      messages: [
        {
          role: "user",
          content: `Summarize this conversation topic in 2-4 words. Reply with ONLY the title, no quotes or punctuation.\n\nUser: ${queryText.slice(0, 500)}`,
        },
      ],
      stream: false,
      max_tokens: 20,
    }),
  });

  if (!res.ok) return;

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const title = json.choices?.[0]?.message?.content?.trim();
  if (title && title.length > 0 && title.length <= 80) {
    await updateThreadTitle(db, threadId, title);
  }
}
