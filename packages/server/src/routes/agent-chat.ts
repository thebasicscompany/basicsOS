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
import { drainNeedsConnections } from "@/lib/pending-connections.js";
import { readdirSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type BetterAuthInstance = ReturnType<typeof createAuth>;

/** "slack" -> "Slack" (good enough for a Connect button label). */
const prettyApp = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Current files in a thread's artifact dir (names only; [] if none/no dir). */
function listThreadFiles(env: Env, threadId: string): string[] {
  const root = env.HERMES_ARTIFACTS_DIR;
  if (!root) return [];
  try {
    const dir = join(root, threadId);
    return readdirSync(dir).filter((n) => {
      if (n.startsWith(".")) return false;
      try {
        return statSync(join(dir, n)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/**
 * Download chips for files the agent generated THIS turn = files now present in
 * the thread's artifact dir that weren't there before the turn. A snapshot diff
 * (not mtime) — robust to container/host clock skew. Per-thread dirs keep
 * concurrent users isolated.
 */
function artifactChips(env: Env, threadId: string, before: Set<string>): string {
  const fresh = listThreadFiles(env, threadId).filter((n) => !before.has(n));
  if (!fresh.length) return "";
  return (
    "\n\n" +
    fresh
      .map((n) => `[file:${n}](/api/files/${encodeURIComponent(threadId)}/${encodeURIComponent(n)})`)
      .join("\n")
  );
}

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
    // Pre-create the thread's artifact dir so the agent writes INTO an existing
    // dir (and won't invent its own named subdir, which our scan would miss).
    if (env.HERMES_ARTIFACTS_DIR) {
      try {
        mkdirSync(join(env.HERMES_ARTIFACTS_DIR, threadId), { recursive: true });
      } catch {
        /* best-effort */
      }
    }
    const filesBefore = new Set(listThreadFiles(env, threadId)); // snapshot for the artifact diff

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
          // Render a Connect card for every app that hit NEEDS_CONNECTION this
          // turn (deterministic; handles multiple) — the client turns each
          // Composio authUrl link into a Connect button.
          const pending = drainNeedsConnections(sessionKey);
          if (pending.length) {
            const cards =
              "\n\n" + pending.map((p) => `[Connect ${prettyApp(p.app)}](${p.authUrl})`).join("\n\n");
            controller.enqueue(encoder.encode(sdkPart("0", cards)));
            assistantText += cards;
          }
          // Offer any files the agent generated this turn as downloads.
          const chips = artifactChips(env, threadId, filesBefore);
          if (chips) {
            controller.enqueue(encoder.encode(sdkPart("0", chips)));
            assistantText += chips;
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
