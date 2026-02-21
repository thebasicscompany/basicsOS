import { redactMessagesForLLM } from "../middleware/pii-redaction.js";
import { db, llmUsageLogs } from "@basicsos/db";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatCompletionOptions = {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
};

/** Optional telemetry context threaded through from the caller. */
export type LlmTelemetryContext = {
  tenantId?: string | undefined;
  userId?: string | undefined;
  featureName?: string | undefined;
};

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type ChatCompletionResponse = {
  content: string;
  finishReason: string;
  usage?: LlmUsage | undefined;
};

// ---------------------------------------------------------------------------
// API config — gateway takes priority; Anthropic direct as fallback.
//
// Supported env var names (all aliases work):
//   BASICOS_API_URL  or  GATEWAY_URL   — gateway base URL
//   BASICOS_API_KEY  or  GATEWAY_API_KEY — gateway key for LLM calls
//   AI_API_KEY  or  ANTHROPIC_API_KEY  — key for direct Anthropic OR gateway
//     (if the key starts with "bos_live_sk_" it is treated as a gateway key)
// ---------------------------------------------------------------------------

const GATEWAY_URL = (
  process.env["BASICOS_API_URL"] ??
  process.env["GATEWAY_URL"] ??
  ""
).replace(/\/$/, "");

const GATEWAY_KEY =
  process.env["BASICOS_API_KEY"] ??
  process.env["GATEWAY_API_KEY"] ??
  "";

const RAW_AI_KEY =
  process.env["AI_API_KEY"] ??
  process.env["ANTHROPIC_API_KEY"] ??
  "";

// bos_live_sk_* and bos_test_sk_* are gateway keys, not Anthropic keys
const isGatewayKey = (key: string): boolean =>
  key.startsWith("bos_live_sk_") || key.startsWith("bos_test_sk_");

type ApiMode = "gateway" | "anthropic";

type ApiConfig = { mode: ApiMode; key: string; url: string };

const getApiConfig = (): ApiConfig | null => {
  // Explicit gateway config takes highest priority
  if (GATEWAY_KEY && GATEWAY_URL) return { mode: "gateway", key: GATEWAY_KEY, url: GATEWAY_URL };
  // AI_API_KEY set to a gateway key (bos_live_sk_*) — route to gateway
  if (RAW_AI_KEY && isGatewayKey(RAW_AI_KEY) && GATEWAY_URL) {
    return { mode: "gateway", key: RAW_AI_KEY, url: GATEWAY_URL };
  }
  // Anthropic direct
  if (RAW_AI_KEY && !isGatewayKey(RAW_AI_KEY)) {
    return { mode: "anthropic", key: RAW_AI_KEY, url: "https://api.anthropic.com" };
  }
  return null;
};

const DEFAULT_GATEWAY_MODEL = "basics-chat-smart";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

const defaultModel = (mode: ApiMode): string =>
  mode === "gateway" ? DEFAULT_GATEWAY_MODEL : DEFAULT_ANTHROPIC_MODEL;

const buildHeaders = (cfg: ApiConfig): Record<string, string> =>
  cfg.mode === "gateway"
    ? { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` }
    : { "Content-Type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" };

// Gateway uses OpenAI-compat /v1/chat/completions (preserves system role).
// Anthropic direct uses /v1/messages.
const chatUrl = (cfg: ApiConfig): string =>
  cfg.mode === "gateway" ? `${cfg.url}/v1/chat/completions` : `${cfg.url}/v1/messages`;

// ---------------------------------------------------------------------------
// Response parsing — gateway returns OpenAI format; Anthropic returns its own
// ---------------------------------------------------------------------------

type OpenAIResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type AnthropicResponse = {
  content?: Array<{ type: string; text: string }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

const parseNonStreamingResponse = (raw: unknown, mode: ApiMode): ChatCompletionResponse => {
  if (!raw || typeof raw !== "object") throw new Error("LLM API returned unexpected response format");

  if (mode === "gateway") {
    const data = raw as OpenAIResponse;
    const content = data.choices?.[0]?.message?.content ?? "";
    const finishReason = data.choices?.[0]?.finish_reason ?? "stop";
    const u = data.usage;
    const usage = u
      ? {
          promptTokens: u.prompt_tokens ?? 0,
          completionTokens: u.completion_tokens ?? 0,
          totalTokens: u.total_tokens ?? 0,
        }
      : undefined;
    return { content, finishReason, usage };
  }

  // Anthropic format
  const data = raw as AnthropicResponse;
  const content = (data.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  const finishReason = data.stop_reason ?? "stop";
  const u = data.usage;
  const usage = u
    ? {
        promptTokens: u.input_tokens ?? 0,
        completionTokens: u.output_tokens ?? 0,
        totalTokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
      }
    : undefined;
  return { content, finishReason, usage };
};

// ---------------------------------------------------------------------------
// Persist usage (fire-and-forget)
// ---------------------------------------------------------------------------

const persistUsage = (
  response: ChatCompletionResponse,
  opts: ChatCompletionOptions,
  telemetry: LlmTelemetryContext,
  mode: ApiMode,
): void => {
  if (!response.usage || !telemetry.tenantId) return;
  db.insert(llmUsageLogs)
    .values({
      tenantId: telemetry.tenantId,
      userId: telemetry.userId ?? null,
      model: opts.model ?? defaultModel(mode),
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      featureName: telemetry.featureName ?? null,
    })
    .catch((err: unknown) => {
      console.error("[llm-client] Failed to persist usage log:", err);
    });
};

// ---------------------------------------------------------------------------
// Streaming — yields text deltas; handles both gateway (OpenAI SSE) and Anthropic SSE
// ---------------------------------------------------------------------------

type OpenAIStreamChunk = {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type AnthropicStreamEvent = {
  type: string;
  delta?: { type: string; text?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
};

export async function* chatCompletionStream(
  opts: ChatCompletionOptions,
  telemetry: LlmTelemetryContext = {},
): AsyncGenerator<string> {
  const cfg = getApiConfig();
  if (!cfg) {
    yield "AI response unavailable — configure BASICOS_API_KEY or ANTHROPIC_API_KEY";
    return;
  }

  const safeMessages = redactMessagesForLLM(opts.messages) as ChatMessage[];

  const response = await fetch(chatUrl(cfg), {
    method: "POST",
    headers: buildHeaders(cfg),
    body: JSON.stringify({
      model: opts.model ?? defaultModel(cfg.mode),
      max_tokens: 2048,
      stream: true,
      messages: safeMessages,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const raw = dataLine.slice(6).trim();
      if (raw === "[DONE]") break;

      try {
        if (cfg.mode === "gateway") {
          // OpenAI SSE format: {"choices":[{"delta":{"content":"token"}}]}
          const chunk = JSON.parse(raw) as OpenAIStreamChunk;
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) yield token;
          // Some gateway implementations send usage in the final chunk
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens ?? 0;
            completionTokens = chunk.usage.completion_tokens ?? 0;
          }
        } else {
          // Anthropic SSE format
          const event = JSON.parse(raw) as AnthropicStreamEvent;
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
            yield event.delta.text;
          }
          if (event.type === "message_start" && event.message?.usage) {
            promptTokens = event.message.usage.input_tokens ?? 0;
          }
          if (event.type === "message_delta" && event.usage) {
            completionTokens = event.usage.output_tokens ?? 0;
          }
        }
      } catch {
        // Malformed SSE line — skip
      }
    }
  }

  // Persist usage after stream completes
  if (telemetry.tenantId && (promptTokens > 0 || completionTokens > 0)) {
    db.insert(llmUsageLogs)
      .values({
        tenantId: telemetry.tenantId,
        userId: telemetry.userId ?? null,
        model: opts.model ?? defaultModel(cfg.mode),
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        featureName: telemetry.featureName ?? null,
      })
      .catch((err: unknown) => {
        console.error("[llm-client] Failed to persist streaming usage log:", err);
      });
  }
}

// ---------------------------------------------------------------------------
// Non-streaming completion
// ---------------------------------------------------------------------------

export const chatCompletion = async (
  opts: ChatCompletionOptions,
  telemetry: LlmTelemetryContext = {},
): Promise<ChatCompletionResponse> => {
  const cfg = getApiConfig();
  if (!cfg) {
    return {
      content: "AI response unavailable — configure BASICOS_API_KEY or ANTHROPIC_API_KEY",
      finishReason: "stop",
    };
  }

  const safeMessages = redactMessagesForLLM(opts.messages) as ChatMessage[];

  const response = await fetch(chatUrl(cfg), {
    method: "POST",
    headers: buildHeaders(cfg),
    body: JSON.stringify({
      model: opts.model ?? defaultModel(cfg.mode),
      max_tokens: 2048,
      messages: safeMessages,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
  }

  const raw: unknown = await response.json();
  const result = parseNonStreamingResponse(raw, cfg.mode);
  persistUsage(result, opts, telemetry, cfg.mode);
  return result;
};

// ---------------------------------------------------------------------------
// Vision — analyzes a base64 PNG screenshot
// ---------------------------------------------------------------------------

export const analyzeImage = async (
  base64Png: string,
  prompt: string,
  telemetry: LlmTelemetryContext = {},
): Promise<string> => {
  // Vision requires Anthropic direct (gateway /v1/messages shim passes content through,
  // but fall back gracefully if no config)
  const cfg = getApiConfig();
  if (!cfg) return "AI unavailable — configure BASICOS_API_KEY to enable Workflow Capture.";

  const response = await fetch(`${cfg.url}/v1/messages`, {
    method: "POST",
    headers: buildHeaders(cfg),
    body: JSON.stringify({
      model: cfg.mode === "anthropic" ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_GATEWAY_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: base64Png } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Vision API error: ${response.status}`);

  const raw: unknown = await response.json();
  const result = parseNonStreamingResponse(raw, cfg.mode);

  if (telemetry.tenantId && result.usage) {
    db.insert(llmUsageLogs)
      .values({
        tenantId: telemetry.tenantId,
        userId: telemetry.userId ?? null,
        model: cfg.mode === "anthropic" ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_GATEWAY_MODEL,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        featureName: telemetry.featureName ?? "workflow_capture",
      })
      .catch(() => undefined);
  }

  return result.content;
};
