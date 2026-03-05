import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import { buildCrmSummary, retrieveRelevantContext } from "@/lib/context.js";
import { resolveOrgAiConfig, buildGatewayHeaders } from "@/lib/org-ai-config.js";
import { writeUsageLogSafe } from "@/lib/usage-log.js";
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
import { ensureThread, persistMessage } from "@/routes/gateway-chat/storage.js";
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

    const aiResult = await resolveOrgAiConfig(c, db, env);
    if (!aiResult.ok) return aiResult.response;
    const { crmUser, aiConfig } = aiResult.data;
    const gatewayHeaders = buildGatewayHeaders(aiConfig);

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

    const [crmSummary, ragContext] = await Promise.all([
      buildCrmSummary(db, crmUser.organizationId!),
      retrieveRelevantContext(
        db,
        env.BASICSOS_API_URL,
        gatewayHeaders,
        crmUser.organizationId!,
        queryText,
        5,
        crmUser.id,
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

    const requestStart = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let i = 0; i < 5; i++) {
      let res: Response;
      try {
        res = await fetch(`${env.BASICSOS_API_URL}/v1/chat/completions`, {
          method: "POST",
          headers: gatewayHeaders,
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
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      totalInputTokens += json.usage?.prompt_tokens ?? 0;
      totalOutputTokens += json.usage?.completion_tokens ?? 0;

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

    writeUsageLogSafe(db, {
      organizationId: crmUser.organizationId!,
      crmUserId: crmUser.id,
      feature: "chat",
      model: "basics-chat-smart",
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      durationMs: Date.now() - requestStart,
    });

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
