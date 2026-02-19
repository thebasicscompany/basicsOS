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
