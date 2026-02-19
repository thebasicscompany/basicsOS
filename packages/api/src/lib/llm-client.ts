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

const DEFAULT_MODEL = "claude-sonnet-4-6";

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

type AnthropicResponse = {
  content?: Array<{ type: string; text: string }>;
  stop_reason?: string;
  usage?: AnthropicUsage;
  model?: string;
};

const fetchChatCompletion = async (
  opts: ChatCompletionOptions,
  apiKey: string,
  apiUrl: string,
): Promise<ChatCompletionResponse> => {
  const response = await fetch(`${apiUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: 2048,
      messages: opts.messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
  }

  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object") {
    throw new Error("LLM API returned unexpected response format");
  }
  const data = raw as AnthropicResponse;
  const contentArr = Array.isArray(data.content) ? data.content : [];
  const content = contentArr
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  const finishReason = typeof data.stop_reason === "string" ? data.stop_reason : "stop";
  const usage = data.usage
    ? {
        promptTokens: data.usage.input_tokens ?? 0,
        completionTokens: data.usage.output_tokens ?? 0,
        totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
      }
    : undefined;

  return { content, finishReason, usage };
};

const persistUsage = (
  response: ChatCompletionResponse,
  opts: ChatCompletionOptions,
  telemetry: LlmTelemetryContext,
): void => {
  if (!response.usage || !telemetry.tenantId) return;

  // Fire-and-forget — never block the caller on DB write
  db
    .insert(llmUsageLogs)
    .values({
      tenantId: telemetry.tenantId,
      userId: telemetry.userId ?? null,
      model: opts.model ?? DEFAULT_MODEL,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      featureName: telemetry.featureName ?? null,
    })
    .catch((err: unknown) => {
      console.error("[llm-client] Failed to persist usage log:", err);
    });
};

/**
 * Streaming variant — yields text delta strings from the Anthropic Messages API.
 * Falls back to yielding a single stub response when AI_API_KEY is not set.
 */
export async function* chatCompletionStream(
  opts: ChatCompletionOptions,
  telemetry: LlmTelemetryContext = {},
): AsyncGenerator<string> {
  const apiKey = process.env["AI_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"];
  const apiUrl = process.env["AI_API_URL"] ?? "https://api.anthropic.com";

  const safeMessages = redactMessagesForLLM(opts.messages) as ChatMessage[];

  if (!apiKey) {
    yield "AI response unavailable — configure AI_API_KEY or ANTHROPIC_API_KEY";
    return;
  }

  const response = await fetch(`${apiUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
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
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  type StreamEvent = {
    type: string;
    delta?: { type: string; text?: string };
    usage?: { input_tokens?: number; output_tokens?: number };
    message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newlines
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const raw = dataLine.slice(6).trim();
      if (raw === "[DONE]") break;

      try {
        const event = JSON.parse(raw) as StreamEvent;
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
          yield event.delta.text;
        }
        if (event.type === "message_start" && event.message?.usage) {
          totalInputTokens = event.message.usage.input_tokens ?? 0;
        }
        if (event.type === "message_delta" && event.usage) {
          totalOutputTokens = event.usage.output_tokens ?? 0;
        }
      } catch {
        // Malformed SSE line — skip
      }
    }
  }

  // Persist usage after stream completes
  if (telemetry.tenantId && (totalInputTokens > 0 || totalOutputTokens > 0)) {
    db
      .insert(llmUsageLogs)
      .values({
        tenantId: telemetry.tenantId,
        userId: telemetry.userId ?? null,
        model: opts.model ?? DEFAULT_MODEL,
        promptTokens: totalInputTokens,
        completionTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        featureName: telemetry.featureName ?? null,
      })
      .catch((err: unknown) => {
        console.error("[llm-client] Failed to persist streaming usage log:", err);
      });
  }
}

/**
 * Analyze a screenshot using Claude's vision capability.
 * Returns a plain-text description of the workflow step shown.
 */
export const analyzeImage = async (
  base64Png: string,
  prompt: string,
  telemetry: LlmTelemetryContext = {},
): Promise<string> => {
  const apiKey = process.env["AI_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"];
  const apiUrl = process.env["AI_API_URL"] ?? "https://api.anthropic.com";

  if (!apiKey) return "AI unavailable — configure AI_API_KEY to enable Workflow Capture.";

  const response = await fetch(`${apiUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: base64Png },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Vision API error: ${response.status}`);

  const raw = await response.json() as AnthropicResponse;
  const content = (raw.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  // Persist usage
  if (telemetry.tenantId && raw.usage) {
    const inputTokens = raw.usage.input_tokens ?? 0;
    const outputTokens = raw.usage.output_tokens ?? 0;
    db.insert(llmUsageLogs).values({
      tenantId: telemetry.tenantId,
      userId: telemetry.userId ?? null,
      model: DEFAULT_MODEL,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
      featureName: telemetry.featureName ?? "workflow_capture",
    }).catch(() => undefined);
  }

  return content;
};

export const chatCompletion = async (
  opts: ChatCompletionOptions,
  telemetry: LlmTelemetryContext = {},
): Promise<ChatCompletionResponse> => {
  const apiKey = process.env["AI_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"];
  const apiUrl = process.env["AI_API_URL"] ?? "https://api.anthropic.com";

  const safeMessages = redactMessagesForLLM(opts.messages) as ChatMessage[];

  if (!apiKey) {
    // Return stub response for development
    return {
      content: "AI response unavailable — configure AI_API_KEY or ANTHROPIC_API_KEY",
      finishReason: "stop",
    };
  }

  const response = await fetchChatCompletion({ ...opts, messages: safeMessages }, apiKey, apiUrl);
  persistUsage(response, opts, telemetry);
  return response;
};
