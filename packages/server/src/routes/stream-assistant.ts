/**
 * Stream assistant — CRM-aware AI streaming for the voice pill overlay.
 * POST /stream/assistant { message, history } → SSE data: {token}, data: [DONE]
 */

import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import type { createAuth } from "../auth.js";
import * as schema from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import { buildCrmSummary, retrieveRelevantContext } from "../lib/context.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

const ASSISTANT_SYSTEM_PROMPT =
  "You are Basics OS Company Assistant — an AI grounded in this company's data. Answer questions based on the context provided. Be concise and helpful.";

export function createStreamAssistantRoutes(
  db: Db,
  auth: BetterAuthInstance,
  env: Env
) {
  const app = new Hono();

  app.post("/assistant", authMiddleware(auth), async (c) => {
    const session = c.get("session") as { user?: { id: string } };
    const salesRow = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user!.id))
      .limit(1);

    const sale = salesRow[0];
    if (!sale) {
      return c.json({ error: "User not found in CRM" }, 404);
    }

    const apiKey =
      c.req.header("X-Basics-API-Key")?.trim() || sale.basicsApiKey;
    if (!apiKey) {
      return c.json(
        { error: "Basics API key not configured. Add your key in Settings." },
        400
      );
    }

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
      buildCrmSummary(db, sale.id),
      retrieveRelevantContext(db, env.BASICOS_API_URL, apiKey, sale.id, message),
    ]);

    let contextText = `## Your CRM\n${crmSummary}`;
    if (ragContext) {
      contextText += `\n\n## Relevant context\n${ragContext}`;
    }

    const systemContent = `${ASSISTANT_SYSTEM_PROMPT}\n\n${contextText}`;
    const messages = [
      { role: "system" as const, content: systemContent },
      ...history,
      { role: "user" as const, content: message },
    ];

    let gatewayRes: Response;
    try {
      gatewayRes = await fetch(`${env.BASICOS_API_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "basics-chat-smart",
          messages,
          stream: true,
        }),
      });
    } catch (err) {
      console.error("[stream-assistant] fetch error:", err);
      return c.json({ error: "Failed to reach AI gateway" }, 502);
    }

    if (!gatewayRes.ok || !gatewayRes.body) {
      const errText = await gatewayRes.text().catch(() => "");
      console.error(
        "[stream-assistant] gateway error:",
        gatewayRes.status,
        errText
      );
      return c.json({ error: "Gateway error" }, 502);
    }

    const encoder = new TextEncoder();
    const reader = gatewayRes.body.getReader();
    const decoder = new TextDecoder();

    const outStream = new ReadableStream({
      async start(controller) {
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();

              if (data === "[DONE]") {
                controller.enqueue(
                  encoder.encode('data: [DONE]\n\n')
                );
                return;
              }

              try {
                const chunk = JSON.parse(data) as {
                  choices?: Array<{
                    delta?: { content?: string | null };
                    finish_reason?: string | null;
                  }>;
                };
                const choice = chunk.choices?.[0];
                const content = choice?.delta?.content;
                if (content) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ token: content })}\n\n`
                    )
                  );
                }
                if (choice?.finish_reason === "stop") {
                  controller.enqueue(
                    encoder.encode('data: [DONE]\n\n')
                  );
                  return;
                }
              } catch {
                // skip malformed
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (err) {
          console.error("[stream-assistant] stream error:", err);
        } finally {
          controller.close();
        }
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
