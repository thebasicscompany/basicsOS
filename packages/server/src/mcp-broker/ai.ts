// ai.* — LLM / vision capability for apps (and the agent). Calls the platform
// gateway's /v1/chat/completions with the server Basics key, so apps NEVER hold a
// model key. Gated for apps via the `ai.*` grant; the agent (appGrants=null) is
// ungated. This is how a custom app does "summarize this", "classify", "read this
// image", etc. without provisioning its own LLM.

import type { Env } from "@/env.js";
import type { BrokerTool } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";

// A registered gateway alias (the gateway resolves aliases, not raw provider
// model names). Mirrors the agent's own model; callers may override via `model`.
const DEFAULT_MODEL = "basics-chat-smart-openai";
const MAX_OUTPUT = 4096;

type ChatMessage = { role: string; content: unknown };

async function chatCompletion(
  env: Env,
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number } = {},
): Promise<{ text: string; model: string; usage: { inputTokens: number; outputTokens: number } }> {
  if (!env.BASICSOS_API_URL || !env.SERVER_BASICS_API_KEY) {
    throw new BrokerError("UPSTREAM", "AI gateway is not configured.");
  }
  const model = opts.model?.trim() || DEFAULT_MODEL;
  const res = await fetch(`${env.BASICSOS_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.SERVER_BASICS_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens:
        opts.maxTokens && opts.maxTokens > 0 ? Math.min(Math.trunc(opts.maxTokens), MAX_OUTPUT) : 1024,
      stream: false,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string } | string;
  };
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : data.error?.message;
    throw new BrokerError("UPSTREAM", msg ?? `AI request failed (${res.status}).`);
  }
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

export function buildAITools(env: Env): BrokerTool[] {
  return [
    {
      name: "ai.complete",
      description:
        "Generate text with an LLM — summarize, draft, classify, extract, rewrite, or answer from provided text. Put the full instruction + any content in `prompt`; use `system` for role/format/tone. Returns { text, model, usage }. The platform provides the model; the app needs no LLM key.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "the instruction and/or content to act on" },
          system: { type: "string", description: "optional system instruction (role, output format, tone)" },
          model: { type: "string", description: "optional model override; defaults to a fast capable model" },
          maxTokens: { type: "integer", description: "optional output token cap (default 1024, max 4096)" },
        },
        required: ["prompt"],
        additionalProperties: false,
      },
      meta: { source: "system", writes: false },
      handle: async (args) => {
        const prompt = String(args.prompt ?? "").trim();
        if (!prompt) throw new BrokerError("VALIDATION", "`prompt` is required.");
        const messages: ChatMessage[] = [];
        const system = typeof args.system === "string" ? args.system.trim() : "";
        if (system) messages.push({ role: "system", content: system });
        messages.push({ role: "user", content: prompt });
        return chatCompletion(env, messages, {
          model: typeof args.model === "string" ? args.model : undefined,
          maxTokens: Number(args.maxTokens) || undefined,
        });
      },
    },
    {
      name: "ai.vision",
      description:
        "Analyze an IMAGE with a vision model. Pass `imageUrl` (http(s) or data: URL) and a `prompt` for what to extract/answer (e.g. 'describe this', 'read the text', 'extract the total from this receipt'). Returns { text, model, usage }.",
      inputSchema: {
        type: "object",
        properties: {
          imageUrl: { type: "string", description: "http(s) URL or data: URL of the image" },
          prompt: { type: "string", description: "what to do with the image" },
          model: { type: "string", description: "optional vision-capable model override" },
        },
        required: ["imageUrl", "prompt"],
        additionalProperties: false,
      },
      meta: { source: "system", writes: false },
      handle: async (args) => {
        const imageUrl = String(args.imageUrl ?? "").trim();
        const prompt = String(args.prompt ?? "").trim();
        if (!imageUrl || !prompt)
          throw new BrokerError("VALIDATION", "`imageUrl` and `prompt` are required.");
        const messages: ChatMessage[] = [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ];
        return chatCompletion(env, messages, {
          model: typeof args.model === "string" ? args.model : undefined,
        });
      },
    },
  ];
}
