import { redactMessagesForLLM } from "../middleware/pii-redaction.js";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatCompletionOptions = {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
};

export type ChatCompletionResponse = {
  content: string;
  finishReason: string;
};

const DEFAULT_MODEL = "claude-sonnet-4-6";

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
  const data = raw as Record<string, unknown>;
  const contentArr = Array.isArray(data["content"]) ? data["content"] : [];
  const content = contentArr
    .filter((c): c is { type: string; text: string } => typeof c === "object" && c !== null && (c as Record<string, unknown>)["type"] === "text")
    .map((c) => c.text)
    .join("");
  const finishReason = typeof data["stop_reason"] === "string" ? data["stop_reason"] : "stop";

  return { content, finishReason };
};

export const chatCompletion = async (opts: ChatCompletionOptions): Promise<ChatCompletionResponse> => {
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

  return fetchChatCompletion({ ...opts, messages: safeMessages }, apiKey, apiUrl);
};
