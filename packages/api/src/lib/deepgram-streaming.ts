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
 *                      JSON: { type: "reconnecting", attempt } during auto-reconnect
 *                      JSON: { type: "error", message } on failure
 *                      JSON: { type: "closed", reason? } when Deepgram stream ends
 */

import { isGatewayConfigured, isDeepgramConfigured } from "./gateway-client.js";

const DEEPGRAM_API_KEY = process.env["DEEPGRAM_API_KEY"] ?? "";
const KEEPALIVE_INTERVAL_MS = 5_000;
const MAX_RECONNECT_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeepgramWord = {
  word: string;
  speaker?: number;
};

type DeepgramStreamResult = {
  type: string;
  channel?: { alternatives?: Array<{ transcript?: string; words?: DeepgramWord[] }> };
  is_final?: boolean;
  speech_final?: boolean;
};

type ClientSender = {
  send: (data: string | ArrayBuffer | Uint8Array) => void;
};

export type DeepgramEncodingConfig = {
  encoding?: string;
  sampleRate?: number;
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
const buildDeepgramUrl = (config?: DeepgramEncodingConfig): string => {
  const params = new URLSearchParams({
    model: "nova-2",
    punctuate: "true",
    smart_format: "true",
    diarize: "true",
  });
  if (config?.encoding) {
    params.set("encoding", config.encoding);
    // Raw PCM requires explicit channel count — AudioTee outputs mono
    params.set("channels", "1");
  }
  if (config?.sampleRate) {
    params.set("sample_rate", String(config.sampleRate));
  }
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

/** Extract the dominant speaker index from Deepgram's words array. */
const getDominantSpeaker = (words?: DeepgramWord[]): number | undefined => {
  if (!words || words.length === 0) return undefined;
  const counts = new Map<number, number>();
  for (const w of words) {
    if (w.speaker !== undefined) {
      counts.set(w.speaker, (counts.get(w.speaker) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return undefined;
  let maxCount = 0;
  let dominant = 0;
  for (const [speaker, count] of counts) {
    if (count > maxCount) { maxCount = count; dominant = speaker; }
  }
  return dominant;
};

/** Handle a Deepgram message and forward transcript results to the client. */
const handleDeepgramMessage = (client: ClientSender, event: MessageEvent): void => {
  const data = typeof event.data === "string"
    ? event.data
    : new TextDecoder().decode(event.data as ArrayBuffer);
  const result = JSON.parse(data) as DeepgramStreamResult;

  if (result.type !== "Results") return;
  const alt = result.channel?.alternatives?.[0];
  const transcript = alt?.transcript ?? "";
  if (!transcript) return;

  const speaker = getDominantSpeaker(alt?.words);

  sendToClient(client, {
    type: "transcript",
    transcript,
    is_final: result.is_final ?? false,
    speech_final: result.speech_final ?? false,
    ...(speaker !== undefined ? { speaker } : {}),
  });
};

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------

/**
 * Create a Deepgram streaming WebSocket and wire it to the client WebSocket.
 * Returns a handle for sending audio, keeping alive, and closing.
 *
 * Includes auto-reconnect with exponential backoff (500ms → 1s → 2s → 4s → 8s)
 * when Deepgram disconnects unexpectedly. Audio is dropped during reconnect gaps.
 */
export const createDeepgramStream = (
  clientWs: ClientSender,
  onClose?: () => void,
  encodingConfig?: DeepgramEncodingConfig,
  label?: string,
): DeepgramStreamHandle => {
  if (!isDeepgramConfigured()) {
    const msg = isGatewayConfigured()
      ? "Gateway streaming not yet supported. Set DEEPGRAM_API_KEY for real-time transcription."
      : "No transcription service configured. Set DEEPGRAM_API_KEY.";
    sendToClient(clientWs, { type: "error", message: msg });
    return noopHandle(onClose);
  }

  const tag = label ?? "stream";
  const dgUrl = buildDeepgramUrl(encodingConfig);

  let closedByUs = false;
  let reconnectAttempt = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let currentDgWs: WebSocket | null = null;
  let isConnected = false;
  let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  const clearKeepAlive = (): void => {
    if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
  };

  const connectWebSocket = (): void => {
    const dgWs = new WebSocket(dgUrl, { headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` } });
    currentDgWs = dgWs;

    dgWs.onopen = () => {
      console.log(`[deepgram-streaming][${tag}] Connected to Deepgram${reconnectAttempt > 0 ? ` (reconnect #${reconnectAttempt})` : ""}`);
      isConnected = true;
      reconnectAttempt = 0;
      sendToClient(clientWs, { type: "ready" });
      keepAliveInterval = setInterval(() => {
        if (dgWs.readyState === WebSocket.OPEN) {
          dgWs.send(JSON.stringify({ type: "KeepAlive" }));
        }
      }, KEEPALIVE_INTERVAL_MS);
    };

    dgWs.onmessage = (event) => {
      try {
        handleDeepgramMessage(clientWs, event);
      } catch (err: unknown) {
        console.error(`[deepgram-streaming][${tag}] Parse error:`, err instanceof Error ? err.message : err);
      }
    };

    dgWs.onerror = () => {
      sendToClient(clientWs, { type: "error", message: "Deepgram connection error" });
    };

    dgWs.onclose = (event) => {
      console.log(`[deepgram-streaming][${tag}] Deepgram closed: code=${event.code}`);
      isConnected = false;
      clearKeepAlive();

      if (closedByUs) return;

      // Auto-reconnect with exponential backoff
      if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempt++;
        const delay = BACKOFF_BASE_MS * Math.pow(2, reconnectAttempt - 1);
        console.log(`[deepgram-streaming][${tag}] Reconnecting in ${delay}ms (attempt ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`);
        sendToClient(clientWs, { type: "reconnecting", attempt: reconnectAttempt });
        reconnectTimeout = setTimeout(connectWebSocket, delay);
      } else {
        console.error(`[deepgram-streaming][${tag}] Max reconnect attempts reached — giving up`);
        sendToClient(clientWs, { type: "closed", reason: "max_retries" });
        onClose?.();
      }
    };
  };

  // Initial connection
  connectWebSocket();

  return {
    sendAudio: (data) => {
      if (currentDgWs?.readyState === WebSocket.OPEN) {
        currentDgWs.send(data);
      }
    },
    keepAlive: () => {
      if (currentDgWs?.readyState === WebSocket.OPEN) {
        currentDgWs.send(JSON.stringify({ type: "KeepAlive" }));
      }
    },
    close: () => {
      closedByUs = true;
      clearKeepAlive();
      if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
      if (currentDgWs?.readyState === WebSocket.OPEN) {
        currentDgWs.send(JSON.stringify({ type: "CloseStream" }));
        currentDgWs.close();
      }
      isConnected = false;
      onClose?.();
    },
    isOpen: () => isConnected && currentDgWs?.readyState === WebSocket.OPEN,
  };
};
