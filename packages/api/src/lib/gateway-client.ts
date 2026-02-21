/**
 * HTTP client for the Basics OS infra gateway.
 *
 * The gateway handles Deepgram TTS/STT (and LiteLLM chat completions) behind
 * a single API-key-authenticated endpoint.  Configure via env vars:
 *
 *   BASICOS_API_URL=https://api.basics.so   (or http://localhost:3002 in dev)
 *   BASICOS_API_KEY=bos_live_sk_...
 */

const GATEWAY_URL = (
  process.env["BASICOS_API_URL"] ??
  process.env["GATEWAY_URL"] ??
  ""
).replace(/\/$/, "");

const GATEWAY_API_KEY =
  process.env["BASICOS_API_KEY"] ??
  process.env["GATEWAY_API_KEY"] ??
  "";

export const isGatewayConfigured = (): boolean => Boolean(GATEWAY_URL && GATEWAY_API_KEY);

type DeepgramResult = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{ transcript?: string }>;
    }>;
  };
};

/**
 * Transcribe audio via the gateway (Deepgram nova-2).
 * Accepts raw audio bytes + MIME type, returns the transcript string.
 */
export const transcribeAudio = async (
  audioBuffer: ArrayBuffer,
  mimeType: string,
): Promise<string> => {
  if (!isGatewayConfigured()) throw new Error("Gateway not configured");

  const base64 = Buffer.from(audioBuffer).toString("base64");
  const res = await fetch(`${GATEWAY_URL}/v1/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GATEWAY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "basics-stt", audio: base64, mime_type: mimeType }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Gateway STT error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as DeepgramResult;
  return json.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
};

/**
 * Synthesize speech via the gateway (Deepgram aura-2).
 * Returns raw audio bytes (mp3 by default).
 */
export const synthesizeSpeech = async (text: string): Promise<ArrayBuffer> => {
  if (!isGatewayConfigured()) throw new Error("Gateway not configured");

  const res = await fetch(`${GATEWAY_URL}/v1/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GATEWAY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "basics-tts", input: text, encoding: "mp3" }),
  });

  if (!res.ok) {
    const text2 = await res.text().catch(() => res.statusText);
    throw new Error(`Gateway TTS error ${res.status}: ${text2}`);
  }

  return res.arrayBuffer();
};

/** Returns config info safe to surface in the admin UI (never exposes the full key). */
export const getGatewayConfig = (): {
  gatewayUrl: string | null;
  configured: boolean;
  keyPrefix: string | null;
  key: string | null;
} => ({
  gatewayUrl: GATEWAY_URL || null,
  configured: isGatewayConfigured(),
  keyPrefix: GATEWAY_API_KEY ? `${GATEWAY_API_KEY.slice(0, 16)}…` : null,
  key: GATEWAY_API_KEY || null,
});
