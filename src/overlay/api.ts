/**
 * HTTP client for the voice pill overlay.
 * All authenticated requests are proxied through Electron main process.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

type GatewayErrorEnvelope = {
  error?:
    | string
    | {
        message?: string;
        code?: string;
      };
};

type ProxyResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  encoding: "text" | "base64";
};

export class VoiceApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "VoiceApiError";
    this.status = status;
    this.code = code;
  }
}

const readErrorEnvelope = (res: ProxyResponse): VoiceApiError => {
  let fallback = `Request failed (${res.status})`;
  let code: string | undefined;

  try {
    const contentType = res.headers["content-type"] ?? "";
    if (contentType.includes("application/json")) {
      const json = JSON.parse(res.body) as GatewayErrorEnvelope;
      if (typeof json.error === "string") {
        fallback = json.error;
      } else if (json.error?.message) {
        fallback = json.error.message;
        code = json.error.code;
      }
    } else {
      const text = res.body;
      if (text.trim()) fallback = text.trim().slice(0, 300);
    }
  } catch {
    // keep fallback
  }

  return new VoiceApiError(fallback, res.status, code);
};

const fetchWithSession = async (
  path: string,
  init: { method: string; headers?: Record<string, string>; body?: string },
  options?: { timeoutMs?: number; retries?: number },
): Promise<ProxyResponse> => {
  const proxyRequest = window.electronAPI?.proxyOverlayRequest;
  if (!proxyRequest)
    throw new VoiceApiError(
      "Overlay bridge unavailable",
      500,
      "bridge_unavailable",
    );

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options?.retries ?? 0;

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= retries) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new VoiceApiError("Voice request timed out", 504, "timeout"),
            ),
          timeoutMs,
        );
      });
      const res = (await Promise.race([
        proxyRequest({
          path,
          method: init.method,
          headers: init.headers,
          body: init.body,
        }),
        timeoutPromise,
      ])) as ProxyResponse;
      if (!res.ok) {
        throw readErrorEnvelope(res);
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      attempt += 1;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new VoiceApiError("Voice request failed", 500);
};

export const synthesizeSpeech = async (
  text: string,
): Promise<ArrayBuffer | null> => {
  try {
    const res = await fetchWithSession(
      "/v1/audio/speech",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      },
      { retries: 1 },
    );
    if (res.encoding !== "base64") {
      return new TextEncoder().encode(res.body).buffer;
    }
    const bytes = Uint8Array.from(atob(res.body), (char) => char.charCodeAt(0));
    return bytes.buffer;
  } catch {
    return null;
  }
};

export const transcribeAudioBlob = async (
  blob: Blob,
): Promise<string | null> => {
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      "",
    ),
  );

  try {
    const res = await fetchWithSession(
      "/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio: base64,
          mime_type: blob.type || "audio/webm",
        }),
      },
      { retries: 1, timeoutMs: 25_000 },
    );
    const json = JSON.parse(res.body) as {
      transcript?: string;
      text?: string;
    };
    return json.transcript ?? json.text ?? null;
  } catch (err) {
    console.error("[voice] transcribeAudioBlob failed:", err);
    if (err instanceof VoiceApiError) throw err;
    throw new VoiceApiError(
      err instanceof Error ? err.message : "Transcription request failed",
      500,
    );
  }
};

/** Upload transcript text to backend. */
export const uploadMeetingTranscript = async (
  meetingId: string,
  transcriptText: string,
): Promise<void> => {
  await fetchWithSession(
    `/api/meetings/${meetingId}/transcript`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: transcriptText }),
    },
    { retries: 1 },
  );
};

/** Save meeting notes (inline notepad). */
export const saveMeetingNotes = async (
  meetingId: string,
  notes: string,
): Promise<void> => {
  console.warn(`[MEETING:NOTES] saving meetingId=${meetingId} notesLen=${notes.length} t=${Date.now()}`);
  await fetchWithSession(
    `/api/meetings/${meetingId}/notes`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    },
    { retries: 1 },
  );
  console.warn(`[MEETING:NOTES] saved successfully meetingId=${meetingId} t=${Date.now()}`);
};

/** Trigger LLM summarization for a completed meeting. */
export const processMeeting = async (meetingId: string): Promise<void> => {
  await fetchWithSession(
    `/api/meetings/${meetingId}/process`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { retries: 1, timeoutMs: 60_000 },
  );
};

export async function* streamAssistant(
  message: string,
  history: Array<{ role: string; content: string }>,
  options?: {
    timeoutMs?: number;
    threadId?: string;
    onThreadId?: (threadId: string) => void;
  },
): AsyncGenerator<string> {
  const res = await fetchWithSession(
    "/stream/assistant",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, history, threadId: options?.threadId }),
    },
    { timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS },
  );
  const nextThreadId = res.headers["x-thread-id"] ?? res.headers["X-Thread-Id"];
  if (nextThreadId) {
    options?.onThreadId?.(nextThreadId);
  }
  if (!res.body) throw new VoiceApiError("Empty stream response", 502);
  const lines = res.body.split("\n");
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") return;
    try {
      const parsed = JSON.parse(data) as { token?: string };
      if (parsed.token) yield parsed.token;
    } catch {
      // ignore malformed chunk
    }
  }
}
