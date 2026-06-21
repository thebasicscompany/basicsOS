// basics-agent — thin client for this company's hermes sidecar.
//
// Our backend drives hermes over its built-in OpenAI-compatible HTTP API server
// (bearer API_SERVER_KEY). Each BasicsOS chat thread maps to a hermes session via
// the session key, so hermes holds the conversational memory and reaches CRM/
// memory tools through the MCP Broker. See docs/PLATFORM…md §5.4 + BUILD_PLAN M3.

import type { Env } from "@/env.js";

/**
 * The hermes session key for a (user, thread). hermes caches one agent per key
 * and persists its session, so the same key continues the same conversation.
 *   agent:main:basicsos:dm:{userId}:{threadId}
 */
export function buildSessionKey(userId: string | number, threadId: string | number): string {
  return `agent:main:basicsos:dm:${userId}:${threadId}`;
}

export interface HermesTurnOptions {
  env: Env;
  sessionKey: string;
  /** the new user message; prior turns are recalled by hermes via the session key */
  message: string;
  signal?: AbortSignal;
}

function hermesHeaders(env: Env, sessionKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    Authorization: `Bearer ${env.HERMES_API_SERVER_KEY ?? ""}`,
    "X-Hermes-Session-Key": sessionKey,
  };
}

/**
 * Stream assistant text deltas for one turn. hermes returns OpenAI-style SSE
 * (`data: {choices:[{delta:{content}}]}` … `data: [DONE]`); we yield the content
 * deltas. Throws on a non-2xx / bodyless response.
 */
export async function* streamHermesText(opts: HermesTurnOptions): AsyncGenerator<string> {
  const { env, sessionKey, message, signal } = opts;
  const res = await fetch(`${env.HERMES_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: hermesHeaders(env, sessionKey),
    body: JSON.stringify({
      model: "hermes-agent",
      stream: true,
      messages: [{ role: "user", content: message }],
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new HermesError(res.status, detail.slice(0, 500));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue; // ignore blank lines / event: frames
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          error?: { message?: string };
        };
        if (json.error) throw new HermesError(502, json.error.message ?? "hermes stream error");
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) yield delta;
      } catch (err) {
        if (err instanceof HermesError) throw err;
        // ignore non-JSON keepalive / partial frames
      }
    }
  }
}

/** Collect a full (non-streamed) completion. */
export async function hermesComplete(opts: HermesTurnOptions): Promise<string> {
  let out = "";
  for await (const delta of streamHermesText(opts)) out += delta;
  return out;
}

export class HermesError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HermesError";
    this.status = status;
  }
}
