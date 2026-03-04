/**
 * HTTP client for the voice pill overlay.
 * Calls basicsOSnew server (BFF) with Bearer session token.
 */

let cachedApiUrl: string | null = null;

const getApiUrl = async (): Promise<string> => {
  if (cachedApiUrl) return cachedApiUrl;
  cachedApiUrl = (await window.electronAPI?.getApiUrl()) ?? "http://localhost:3001";
  return cachedApiUrl;
};

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

export const transcribeAudioBlob = async (blob: Blob): Promise<string | null> => {
  const apiUrl = await getApiUrl();
  const token = await window.electronAPI?.getSessionToken();

  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );

  try {
    const res = await fetch(`${apiUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        audio: base64,
        mime_type: blob.type || "audio/webm",
      }),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { transcript?: string };
    return json.transcript ?? null;
  } catch {
    return null;
  }
};

/** Stub — no backend. Used by meeting recorder. */
export const uploadMeetingTranscript = async (
  _meetingId: string,
  _transcriptText: string
): Promise<void> => {
  // No-op when stubbed
};

/** Stub — no backend. Used by meeting recorder. */
export const processMeeting = async (_meetingId: string): Promise<void> => {
  // No-op when stubbed
};

export async function* streamAssistant(
  message: string,
  history: Array<{ role: string; content: string }>
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
