import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { corsMiddleware } from "./middleware/cors.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { appRouter } from "./routers/index.js";
import { createContext } from "./context.js";
import { validateVirtualKey } from "./routers/llm-keys.js";
import { chatCompletion, chatCompletionStream } from "./lib/llm-client.js";
import { auth } from "@basicsos/auth";
import { semanticSearch } from "./lib/semantic-search.js";
import { analyzeQuery } from "./lib/query-analyzer.js";
import { assembleContext } from "./lib/context-assembler.js";

export const createApp = (): Hono => {
  const app = new Hono();

  // Middleware chain order matters
  app.use("*", corsMiddleware);
  app.use("*", rateLimitMiddleware);

  // Health check — no auth required
  app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

  // LLM Proxy — accepts virtual keys (bos_live_sk_...) and forwards to the
  // configured AI provider. Supports OpenAI-compatible /v1/chat/completions format.
  // This allows customers to use BasicOS-managed keys with any OpenAI SDK.
  app.post("/v1/chat/completions", async (c) => {
    const authHeader = c.req.header("Authorization") ?? "";
    const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!rawKey.startsWith("bos_live_sk_")) {
      return c.json({ error: { message: "Invalid API key format", type: "invalid_request_error" } }, 401);
    }

    const tenantId = await validateVirtualKey(rawKey);
    if (!tenantId) {
      return c.json({ error: { message: "API key not found or inactive", type: "invalid_request_error" } }, 401);
    }

    type OpenAIMessage = { role: string; content: string };
    type OpenAIBody = { messages?: OpenAIMessage[]; model?: string; temperature?: number };
    const body = await c.req.json() as OpenAIBody;
    const messages = (body.messages ?? []).map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));

    if (messages.length === 0) {
      return c.json({ error: { message: "messages array is required", type: "invalid_request_error" } }, 400);
    }

    const opts = {
      messages,
      ...(body.model !== undefined ? { model: body.model } : {}),
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    };
    const result = await chatCompletion(opts, { tenantId, featureName: "llm-proxy" });

    // Return an OpenAI-compatible response envelope
    return c.json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: body.model ?? "claude-sonnet-4-6",
      choices: [{
        index: 0,
        message: { role: "assistant", content: result.content },
        finish_reason: result.finishReason,
      }],
      usage: result.usage
        ? {
            prompt_tokens: result.usage.promptTokens,
            completion_tokens: result.usage.completionTokens,
            total_tokens: result.usage.totalTokens,
          }
        : undefined,
    });
  });

  // Streaming assistant endpoint — SSE, one token per event
  // POST /stream/assistant { message: string, history: ConversationMessage[] }
  app.post("/stream/assistant", async (c) => {
    // Validate session from cookie
    const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null);
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const raw = session.user as Record<string, unknown>;
    const tenantId = typeof raw["tenantId"] === "string" ? raw["tenantId"] : null;
    if (!tenantId) return c.json({ error: "No tenant context" }, 401);

    type ChatBody = { message?: string; history?: Array<{ role: string; content: string }> };
    const body = await c.req.json() as ChatBody;
    const message = body.message?.trim() ?? "";
    if (!message) return c.json({ error: "message is required" }, 400);

    const history = (body.history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Build RAG context
    const { searchQuery } = analyzeQuery(message);
    let contextText = "No relevant company data found.";
    try {
      const results = await semanticSearch(searchQuery, tenantId, 20);
      const { chunks } = assembleContext(results);
      if (chunks.length > 0) {
        contextText = chunks
          .map((ch, i) => `[Source ${i + 1} — ${ch.source} ID: ${ch.sourceId}]\n${ch.text}`)
          .join("\n\n---\n\n");
      }
    } catch { /* empty context on failure */ }

    const systemPrompt = `You are Basics OS Company Assistant — an AI grounded in this company's data.\nAnswer questions based ONLY on the context provided below.\n\n## Company Data Context\n${contextText}`;
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history,
      { role: "user" as const, content: message },
    ];

    // Stream SSE back to client
    const stream = chatCompletionStream(
      { messages },
      { tenantId, userId: session.user.id, featureName: "assistant.chat.stream" },
    );

    return new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const token of stream) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "stream error";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          } finally {
            controller.close();
          }
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": c.req.header("Origin") ?? "*",
        },
      },
    );
  });

  // tRPC routes — auth + tenant context injected per-request via createContext
  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: (opts) => createContext(opts),
      onError: ({ error, path }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error(`tRPC error on ${path}:`, error);
        }
      },
    }),
  );

  return app;
};
