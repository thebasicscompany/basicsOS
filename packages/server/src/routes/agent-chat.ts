// Hermes-backed chat route. Replaces the old in-process planToolWorkflow brain
// (gateway-chat.ts) with the per-company hermes agent: a BasicsOS thread maps to
// a hermes session, hermes reads CRM/memory through the MCP Broker, and we stream
// its reply back in the Vercel AI SDK v1 data-stream format the chat UI already
// consumes. Threads/messages persist in ai_threads/ai_messages exactly as before,
// so history survives a refresh. See BUILD_PLAN_HERMES.md M3.

import { Hono } from "hono";
import type { Db } from "@/db/client.js";
import type { createAuth } from "@/auth.js";
import type { Env } from "@/env.js";
import { authMiddleware } from "@/middleware/auth.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { logger } from "@/lib/logger.js";
import { ensureThread, persistMessage } from "@/routes/gateway-chat/storage.js";
import { sdkPart, requestSchema } from "@/routes/gateway-chat/protocol.js";
import { buildSessionKey, streamHermesText, HermesError } from "@/lib/hermes/client.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

const log = logger.child({ component: "agent-chat" });

/** Pull the latest user message text out of the AI-SDK messages array. */
function latestUserText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i] as { role?: string; content?: unknown; parts?: Array<{ type?: string; text?: string }> };
    if (m?.role !== "user") continue;
    if (typeof m.content === "string" && m.content.trim()) return m.content;
    if (Array.isArray(m.parts)) {
      const text = m.parts
        .filter((p) => p?.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join("");
      if (text.trim()) return text;
    }
  }
  return "";
}

export function createAgentChatRoutes(db: Db, auth: BetterAuthInstance, env: Env) {
  const app = new Hono();

  app.post("/", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;
    const { crmUser } = authz;
    if (!crmUser.organizationId) return c.json({ error: "Organization not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    }

    const userText = latestUserText(parsed.data.messages);
    if (!userText) return c.json({ error: "No user message" }, 400);

    const threadId = await ensureThread(db, crmUser, parsed.data.threadId, parsed.data.channel);
    await persistMessage(db, threadId, "user", userText);

    const sessionKey = buildSessionKey(crmUser.id, threadId);
    const encoder = new TextEncoder();
    let assistantText = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of streamHermesText({
            env,
            sessionKey,
            message: userText,
            signal: c.req.raw.signal,
          })) {
            assistantText += delta;
            controller.enqueue(encoder.encode(sdkPart("0", delta)));
          }
          if (assistantText.trim()) {
            await persistMessage(db, threadId, "assistant", assistantText);
          }
          controller.enqueue(encoder.encode(sdkPart("d", { finishReason: "stop" })));
        } catch (err) {
          log.error({ err, threadId }, "agent-chat stream failed");
          // Persist any partial reply so the thread isn't left dangling.
          if (assistantText.trim()) {
            await persistMessage(db, threadId, "assistant", assistantText).catch(() => {});
          }
          const msg =
            err instanceof HermesError
              ? `The agent is unavailable right now (hermes ${err.status}).`
              : "The agent hit an error.";
          controller.enqueue(encoder.encode(sdkPart("3", msg)));
          controller.enqueue(encoder.encode(sdkPart("d", { finishReason: "error" })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
        "Cache-Control": "no-cache",
        "X-Thread-Id": threadId,
        "X-Tools-Used": "",
        "Access-Control-Expose-Headers": "X-Thread-Id, X-Tools-Used",
      },
    });
  });

  return app;
}
