/**
 * Deepgram Streaming Transcription Proxy
 *
 * Manages WebSocket connections between clients and Deepgram's real-time
 * transcription API. The API server acts as a proxy so the Deepgram API key
 * stays server-side.
 *
 * Protocol (client <-> API server):
 *   Client -> Server:  binary frames (raw audio from MediaRecorder)
 *                      JSON: { type: "CloseStream" } to end transcription
 *                      JSON: { type: "KeepAlive" } to keep connection alive
 *   Server -> Client:  JSON: { type: "transcript", transcript, is_final, speech_final }
 *                      JSON: { type: "ready" } when Deepgram connection is open
 *                      JSON: { type: "error", message } on failure
 *                      JSON: { type: "closed" } when Deepgram stream ends
 */

import { isGatewayConfigured, isDeepgramConfigured } from "./gateway-client.js";

const DEEPGRAM_API_KEY = process.env["DEEPGRAM_API_KEY"] ?? "";
const KEEPALIVE_INTERVAL_MS = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeepgramStreamResult = {
  type: string;
  channel?: { alternatives?: Array<{ transcript?: string }> };
  is_final?: boolean;
  speech_final?: boolean;
};

type ClientSender = {
  send: (data: string | ArrayBuffer | Uint8Array) => void;
};

export type DeepgramStreamHandle = {
  sendAudio: (data: ArrayBuffer | Uint8Array | Buffer) => void;
  keepAlive: () => void;
  close: () => void;
  isOpen: () => boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the Deepgram streaming WebSocket URL. */
const buildDeepgramUrl = (): string => {
  const params = new URLSearchParams({
    model: "nova-2",
    punctuate: "true",
    smart_format: "true",
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
};

/** Send a JSON message to the client, swallowing errors if disconnected. */
const sendToClient = (ws: ClientSender, msg: Record<string, unknown>): void => {
  try { ws.send(JSON.stringify(msg)); } catch { /* client gone */ }
};

/** Create a no-op handle (used when no transcription service is available). */
const noopHandle = (onClose?: () => void): DeepgramStreamHandle => ({
  sendAudio: () => {},
  keepAlive: () => {},
  close: () => { onClose?.(); },
  isOpen: () => false,
});

/** Handle a Deepgram message and forward transcript results to the client. */
const handleDeepgramMessage = (client: ClientSender, event: MessageEvent): void => {
  const data = typeof event.data === "string"
    ? event.data
    : new TextDecoder().decode(event.data as ArrayBuffer);
  const result = JSON.parse(data) as DeepgramStreamResult;

  if (result.type !== "Results") return;
  const transcript = result.channel?.alternatives?.[0]?.transcript ?? "";
  if (!transcript) return;

  sendToClient(client, {
    type: "transcript",
    transcript,
    is_final: result.is_final ?? false,
    speech_final: result.speech_final ?? false,
  });
};

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------

/**
 * Create a Deepgram streaming WebSocket and wire it to the client WebSocket.
 * Returns a handle for sending audio, keeping alive, and closing.
 */
export const createDeepgramStream = (
  clientWs: ClientSender,
  onClose?: () => void,
): DeepgramStreamHandle => {
  if (!isDeepgramConfigured()) {
    const msg = isGatewayConfigured()
      ? "Gateway streaming not yet supported. Set DEEPGRAM_API_KEY for real-time transcription."
      : "No transcription service configured. Set DEEPGRAM_API_KEY.";
    sendToClient(clientWs, { type: "error", message: msg });
    return noopHandle(onClose);
  }

  const dgUrl = buildDeepgramUrl();
  console.log(`[deepgram-streaming] Connecting to Deepgram`);

  const dgWs = new WebSocket(dgUrl, { headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` } });

  let isConnected = false;
  let closedByUs = false;
  let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  const clearKeepAlive = (): void => {
    if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
  };

  dgWs.onopen = () => {
    console.log("[deepgram-streaming] Connected to Deepgram");
    isConnected = true;
    sendToClient(clientWs, { type: "ready" });
    keepAliveInterval = setInterval(() => {
      if (dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(JSON.stringify({ type: "KeepAlive" }));
      }
    }, KEEPALIVE_INTERVAL_MS);
  };

  dgWs.onmessage = (event) => {
    try { handleDeepgramMessage(clientWs, event); }
    catch (err: unknown) {
      console.error("[deepgram-streaming] Parse error:", err instanceof Error ? err.message : err);
    }
  };

  dgWs.onerror = () => {
    sendToClient(clientWs, { type: "error", message: "Deepgram connection error" });
  };

  dgWs.onclose = (event) => {
    console.log(`[deepgram-streaming] Deepgram closed: code=${event.code}`);
    isConnected = false;
    clearKeepAlive();
    if (!closedByUs) {
      sendToClient(clientWs, { type: "closed" });
      onClose?.();
    }
  };

  return {
    sendAudio: (data) => {
      if (dgWs.readyState === WebSocket.OPEN) dgWs.send(data);
    },
    keepAlive: () => {
      if (dgWs.readyState === WebSocket.OPEN) dgWs.send(JSON.stringify({ type: "KeepAlive" }));
    },
    close: () => {
      closedByUs = true;
      clearKeepAlive();
      if (dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(JSON.stringify({ type: "CloseStream" }));
        dgWs.close();
      }
      isConnected = false;
      onClose?.();
    },
    isOpen: () => isConnected && dgWs.readyState === WebSocket.OPEN,
  };
};
