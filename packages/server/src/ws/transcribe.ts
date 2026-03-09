/**
 * WebSocket Transcription Proxy — Deepgram real-time transcription
 *
 * Protocol (client <-> server):
 *   Client -> Server:  binary frames (audio from MediaRecorder or raw PCM)
 *                      JSON: { type: "CloseStream" } to end transcription
 *                      JSON: { type: "KeepAlive" } to keep connection alive
 *   Server -> Client:  JSON: { type: "transcript", transcript, is_final, speech_final, speaker }
 *                      JSON: { type: "ready" } when Deepgram connection is open
 *                      JSON: { type: "reconnecting", attempt } during auto-reconnect
 *                      JSON: { type: "error", message } on failure
 *                      JSON: { type: "closed", reason? } when Deepgram stream ends
 */

import { WebSocketServer, WebSocket as WsWebSocket, type ClientOptions } from "ws";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import { decryptApiKey } from "@/lib/api-key-crypto.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

const KEEPALIVE_INTERVAL_MS = 5_000;
const MAX_RECONNECT_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 500;

type DeepgramWord = { word: string; speaker?: number };
type DeepgramResult = {
  type: string;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      words?: DeepgramWord[];
    }>;
  };
  is_final?: boolean;
  speech_final?: boolean;
};

const sendToClient = (ws: WsWebSocket, msg: Record<string, unknown>): void => {
  try {
    if (ws.readyState === WsWebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  } catch {
    /* client gone */
  }
};

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
    if (count > maxCount) {
      maxCount = count;
      dominant = speaker;
    }
  }
  return dominant;
};

type DeepgramResolution = {
  key: string;
  /** When using the Basics gateway, we connect to the gateway WS endpoint instead of Deepgram directly */
  gatewayUrl: string | null;
  basicsApiKey: string | null;
};

/**
 * Resolve the Deepgram API key for a given organization.
 * Priority: org transcription BYOK → env transcription BYOK → Basics API key (gateway) → error.
 */
async function resolveDeepgramConfig(
  db: Db,
  env: Env,
  organizationId: string,
): Promise<DeepgramResolution | null> {
  // Check org-level transcription BYOK
  const [orgConfig] = await db
    .select()
    .from(schema.orgAiConfig)
    .where(eq(schema.orgAiConfig.organizationId, organizationId))
    .limit(1);

  if (
    orgConfig?.transcriptionByokProvider === "deepgram" &&
    orgConfig.transcriptionApiKeyEnc
  ) {
    const key = decryptApiKey(orgConfig.transcriptionApiKeyEnc);
    if (key) return { key, gatewayUrl: null, basicsApiKey: null };
  }

  // Fallback to env transcription BYOK
  if (
    env.SERVER_TRANSCRIPTION_BYOK_PROVIDER === "deepgram" &&
    env.SERVER_TRANSCRIPTION_BYOK_API_KEY
  ) {
    return { key: env.SERVER_TRANSCRIPTION_BYOK_API_KEY, gatewayUrl: null, basicsApiKey: null };
  }

  // Fallback to Basics API key — use gateway to resolve Deepgram key
  const basicsKey = orgConfig?.apiKeyEnc
    ? decryptApiKey(orgConfig.apiKeyEnc)
    : env.SERVER_BASICS_API_KEY;

  if (basicsKey) {
    // Fetch the Deepgram key from the Basics gateway
    try {
      console.log(`[ws/transcribe] Fetching Deepgram key from gateway: ${env.BASICSOS_API_URL}/v1/transcription/key`);
      const res = await fetch(`${env.BASICSOS_API_URL}/v1/transcription/key`, {
        headers: { Authorization: `Bearer ${basicsKey}` },
      });
      console.log(`[ws/transcribe] Gateway key response: ${res.status}`);
      if (res.ok) {
        const data = (await res.json()) as { key?: string };
        if (data.key) {
          console.log(`[ws/transcribe] Got Deepgram key from gateway (direct connection)`);
          return { key: data.key, gatewayUrl: null, basicsApiKey: basicsKey };
        }
      }
    } catch (err) {
      console.log(`[ws/transcribe] Gateway key endpoint failed:`, err instanceof Error ? err.message : err);
    }

    // If gateway doesn't provide a key endpoint, use the Basics API key directly
    // and connect to Deepgram via the gateway WebSocket proxy
    console.log(`[ws/transcribe] Falling back to gateway WS proxy`);
    return { key: basicsKey, gatewayUrl: env.BASICSOS_API_URL, basicsApiKey: basicsKey };
  }

  return null;
}

/**
 * Authenticate WebSocket connection via session token query param.
 * Returns the CRM user or null.
 */
async function authenticateWs(db: Db, auth: BetterAuthInstance, token: string) {
  try {
    // Better Auth expects session token as a cookie, not a Bearer token
    const session = await auth.api.getSession({
      headers: new Headers({
        Cookie: `better-auth.session_token=${token}`,
      }),
    });
    if (!session?.user?.id) return null;

    const [crmUser] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, session.user.id))
      .limit(1);

    return crmUser ?? null;
  } catch {
    return null;
  }
}

export function attachTranscribeWs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server: HttpServer | { on: (...args: any[]) => any },
  db: Db,
  auth: BetterAuthInstance,
  env: Env,
): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    if (url.pathname !== "/ws/transcribe") return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (clientWs: WsWebSocket, req: IncomingMessage) => {
    console.log(`[ws/transcribe] New client connection from ${req.headers.origin ?? "unknown"}`);
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const token = url.searchParams.get("token");
    const source = url.searchParams.get("source"); // "system" for ScreenCaptureKit
    const encoding = url.searchParams.get("encoding"); // "linear16" for raw PCM
    const sampleRate = url.searchParams.get("sample_rate"); // "16000"

    if (!token) {
      console.log(`[ws/transcribe] Missing token, closing`);
      sendToClient(clientWs, { type: "error", message: "Missing token" });
      clientWs.close();
      return;
    }

    void (async () => {
      const crmUser = await authenticateWs(db, auth, token);
      if (!crmUser || !crmUser.organizationId) {
        sendToClient(clientWs, { type: "error", message: "Unauthorized" });
        clientWs.close();
        return;
      }

      const dgConfig = await resolveDeepgramConfig(
        db,
        env,
        crmUser.organizationId,
      );
      if (!dgConfig) {
        sendToClient(clientWs, {
          type: "error",
          message:
            "Deepgram API key not configured. Set transcription BYOK in Settings.",
        });
        clientWs.close();
        return;
      }

      // Build Deepgram URL
      const params = new URLSearchParams({
        model: "nova-2",
        punctuate: "true",
        smart_format: "true",
        diarize: "true",
      });
      if (encoding) {
        params.set("encoding", encoding);
        params.set("channels", "1");
      }
      if (sampleRate) {
        params.set("sample_rate", sampleRate);
      }

      // If we have a gateway URL, proxy through it; otherwise connect directly to Deepgram
      let dgUrl: string;
      let dgAuthHeader: string;
      if (dgConfig.gatewayUrl) {
        // Use Basics gateway WebSocket proxy for Deepgram
        const gwBase = dgConfig.gatewayUrl.replace(/^http/, "ws");
        dgUrl = `${gwBase}/v1/listen?${params.toString()}`;
        dgAuthHeader = `Bearer ${dgConfig.basicsApiKey ?? dgConfig.key}`;
        console.log(`[ws/transcribe] Using Basics gateway: ${dgUrl.split("?")[0]}`);
      } else {
        dgUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
        dgAuthHeader = `Token ${dgConfig.key}`;
        console.log(`[ws/transcribe] Using direct Deepgram connection`);
      }

      const tag = source === "system" ? "system" : "mixed";
      let closedByUs = false;
      let reconnectAttempt = 0;
      let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
      let currentDgWs: WsWebSocket | null = null;
      let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

      const clearKeepAlive = (): void => {
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
      };

      const connectDeepgram = (): void => {
        const dgWs = new WsWebSocket(dgUrl, {
          headers: { Authorization: dgAuthHeader },
        } as ClientOptions);
        currentDgWs = dgWs;

        dgWs.on("open", () => {
          console.log(
            `[ws/transcribe][${tag}] Connected to Deepgram${reconnectAttempt > 0 ? ` (reconnect #${reconnectAttempt})` : ""}`,
          );
          reconnectAttempt = 0;
          sendToClient(clientWs, { type: "ready" });

          keepAliveInterval = setInterval(() => {
            if (dgWs.readyState === WsWebSocket.OPEN) {
              dgWs.send(JSON.stringify({ type: "KeepAlive" }));
            }
          }, KEEPALIVE_INTERVAL_MS);
        });

        let dgMsgCount = 0;
        dgWs.on("message", (rawData: Buffer | string) => {
          dgMsgCount++;
          try {
            const data = typeof rawData === "string" ? rawData : rawData.toString("utf8");
            const result = JSON.parse(data) as DeepgramResult;

            if (result.type !== "Results") return;
            const alt = result.channel?.alternatives?.[0];
            const transcript = alt?.transcript ?? "";
            if (!transcript) return;

            const speaker = getDominantSpeaker(alt?.words);
            console.log(`[ws/transcribe][${tag}] DG#${dgMsgCount} is_final=${result.is_final} speech_final=${result.speech_final} speaker=${speaker} text="${transcript.slice(0, 60)}"`);
            sendToClient(clientWs, {
              type: "transcript",
              transcript,
              is_final: result.is_final ?? false,
              speech_final: result.speech_final ?? false,
              ...(speaker !== undefined ? { speaker } : {}),
            });
          } catch (err) {
            console.error(`[ws/transcribe][${tag}] Parse error:`, err);
          }
        });

        dgWs.on("error", (err: Error) => {
          console.error(`[ws/transcribe][${tag}] Deepgram WS error:`, err.message ?? err);
          sendToClient(clientWs, {
            type: "error",
            message: "Deepgram connection error",
          });
        });

        dgWs.on("close", (code: number, reason: Buffer) => {
          clearKeepAlive();
          console.log(`[ws/transcribe][${tag}] Deepgram WS closed, code=${code} reason="${reason?.toString() ?? ""}" closedByUs=${closedByUs} audioChunks=${audioChunkCount} dgMsgs=${dgMsgCount}`);
          if (closedByUs) return;

          if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempt++;
            const delay = BACKOFF_BASE_MS * Math.pow(2, reconnectAttempt - 1);
            console.log(
              `[ws/transcribe][${tag}] Reconnecting in ${delay}ms (attempt ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`,
            );
            sendToClient(clientWs, {
              type: "reconnecting",
              attempt: reconnectAttempt,
            });
            reconnectTimeout = setTimeout(connectDeepgram, delay);
          } else {
            console.error(
              `[ws/transcribe][${tag}] Max reconnect attempts reached`,
            );
            sendToClient(clientWs, { type: "closed", reason: "max_retries" });
          }
        });
      };

      let audioChunkCount = 0;

      connectDeepgram();
      clientWs.on("message", (rawData, isBinary) => {
        if (isBinary) {
          audioChunkCount++;
          if (audioChunkCount <= 3 || audioChunkCount % 200 === 0) {
            const size = Array.isArray(rawData) ? rawData.reduce((s, b) => s + b.length, 0) : (rawData as Buffer).length;
            console.log(`[ws/transcribe][${tag}] Audio chunk #${audioChunkCount}, size=${size}`);
          }
          // Forward audio to Deepgram — convert RawData to Buffer
          if (currentDgWs?.readyState === WsWebSocket.OPEN) {
            const buf = Array.isArray(rawData)
              ? Buffer.concat(rawData)
              : rawData;
            currentDgWs.send(buf);
          }
          return;
        }

        // JSON control messages
        const data = rawData;
        try {
          const msg = JSON.parse(data.toString()) as { type: string };
          if (msg.type === "CloseStream") {
            closedByUs = true;
            clearKeepAlive();
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = null;
            }
            if (currentDgWs?.readyState === WsWebSocket.OPEN) {
              currentDgWs.send(JSON.stringify({ type: "CloseStream" }));
              // Wait for Deepgram to close, then send closed to client
              currentDgWs.once("close", () => {
                sendToClient(clientWs, { type: "closed" });
              });
              // Timeout fallback
              setTimeout(() => {
                sendToClient(clientWs, { type: "closed" });
              }, 2000);
            } else {
              sendToClient(clientWs, { type: "closed" });
            }
          } else if (msg.type === "KeepAlive") {
            if (currentDgWs?.readyState === WsWebSocket.OPEN) {
              currentDgWs.send(JSON.stringify({ type: "KeepAlive" }));
            }
          }
        } catch {
          /* not JSON, ignore */
        }
      });

      clientWs.on("close", (code: number, reason: Buffer) => {
        console.log(`[ws/transcribe][${tag}] Client WS closed, code=${code} reason="${reason?.toString() ?? ""}" audioChunks=${audioChunkCount}`);
        closedByUs = true;
        clearKeepAlive();
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        if (currentDgWs?.readyState === WsWebSocket.OPEN) {
          currentDgWs.send(JSON.stringify({ type: "CloseStream" }));
          currentDgWs.close();
        }
      });
    })();
  });
}
