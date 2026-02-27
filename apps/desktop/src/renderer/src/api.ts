/**
 * Thin tRPC HTTP client for the overlay renderer.
 * Calls the API server directly with Bearer auth (session token from main window cookies).
 */

let cachedApiUrl: string | null = null;

const getApiUrl = async (): Promise<string> => {
  if (cachedApiUrl) return cachedApiUrl;
  cachedApiUrl = (await window.electronAPI?.getApiUrl()) ?? "http://localhost:3001";
  return cachedApiUrl;
};

export const trpcCall = async <T>(
  path: string,
  input: unknown,
  method: "query" | "mutation" = "mutation",
): Promise<T> => {
  const apiUrl = await getApiUrl();
  const token = await window.electronAPI?.getSessionToken();

  const url =
    method === "query"
      ? `${apiUrl}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
      : `${apiUrl}/trpc/${path}`;

  const res = await fetch(url, {
    method: method === "query" ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(method === "mutation" ? { body: JSON.stringify(input) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { result: { data: T } };
  return json.result.data;
};

/**
 * Synthesize speech via the basicsOS API proxy → infra gateway → Deepgram.
 * Returns an ArrayBuffer (mp3) or null if the gateway is not configured.
 */
export const synthesizeSpeech = async (text: string): Promise<ArrayBuffer | null> => {
  const apiUrl = await getApiUrl();
  const token = await window.electronAPI?.getSessionToken();

  const res = await fetch(`${apiUrl}/v1/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) return null;
  return res.arrayBuffer();
};

/**
 * Transcribe an audio blob via the basicsOS API proxy -> gateway -> Deepgram Nova-2.
 * Accepts a WebM blob (from MediaRecorder), converts to base64, POSTs to /v1/audio/transcriptions.
 * Returns the transcript string, or null if the gateway is not configured.
 */
export const transcribeAudioBlob = async (blob: Blob): Promise<string | null> => {
  const apiUrl = await getApiUrl();
  const token = await window.electronAPI?.getSessionToken();

  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
  );

  try {
    const res = await fetch(`${apiUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ audio: base64, mime_type: blob.type || "audio/webm" }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[transcribeAudioBlob] Failed: ${res.status} ${errText}`);
      return null;
    }
    const json = (await res.json()) as { transcript?: string };
    return json.transcript ?? null;
  } catch (err: unknown) {
    console.error("[transcribeAudioBlob] Network error:", err instanceof Error ? err.message : err);
    return null;
  }
};

/**
 * Upload a full transcript text to a meeting.
 */
export const uploadMeetingTranscript = async (
  meetingId: string,
  transcriptText: string,
): Promise<void> => {
  console.log(`[api] uploadMeetingTranscript: meetingId=${meetingId}, length=${transcriptText.length} chars`);
  await trpcCall("meetings.uploadTranscript", { meetingId, transcriptText }, "mutation");
  console.log(`[api] uploadMeetingTranscript: success`);
};

/**
 * Trigger AI processing (summarization) for a meeting.
 */
export const processMeeting = async (meetingId: string): Promise<void> => {
  console.log(`[api] processMeeting: meetingId=${meetingId}`);
  await trpcCall("meetings.process", { meetingId }, "mutation");
  console.log(`[api] processMeeting: success`);
};

/**
 * Stream an SSE endpoint (used for assistant.chat streaming).
 * Returns an async generator of string chunks.
 */
export async function* streamAssistant(
  message: string,
  history: Array<{ role: string; content: string }>,
): AsyncGenerator<string> {
  const apiUrl = await getApiUrl();
  const token = await window.electronAPI?.getSessionToken();

  const res = await fetch(`${apiUrl}/stream/assistant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Stream error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      // Parse SSE lines
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
