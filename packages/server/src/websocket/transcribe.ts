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
const MAX_TOTAL_RECONNECTS = 15;
const BACKOFF_BASE_MS = 500;
/** If a connection lives less than this, it counts as "unstable" */
const MIN_STABLE_CONNECTION_MS = 10_000;

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
    if (key) {
      console.warn(`[MEETING:WS:HN] deepgram-key-resolved path=org_byok orgId=${organizationId} t=${Date.now()}`);
      return { key, gatewayUrl: null, basicsApiKey: null };
    }
  }

  // Fallback to env transcription BYOK
  if (
    env.SERVER_TRANSCRIPTION_BYOK_PROVIDER === "deepgram" &&
    env.SERVER_TRANSCRIPTION_BYOK_API_KEY
  ) {
    console.warn(`[MEETING:WS:HN] deepgram-key-resolved path=env_byok orgId=${organizationId} t=${Date.now()}`);
    return { key: env.SERVER_TRANSCRIPTION_BYOK_API_KEY, gatewayUrl: null, basicsApiKey: null };
  }

  // Fallback to Basics API key — use gateway to resolve Deepgram key
  const basicsKey = orgConfig?.apiKeyEnc
    ? decryptApiKey(orgConfig.apiKeyEnc)
    : env.SERVER_BASICS_API_KEY;

  if (basicsKey) {
    // Fetch the Deepgram key from the Basics gateway
    try {
      console.warn(`[MEETING:WS:HN] deepgram-key-fetching path=gateway url=${env.BASICSOS_API_URL}/v1/transcription/key t=${Date.now()}`);
      const res = await fetch(`${env.BASICSOS_API_URL}/v1/transcription/key`, {
        headers: { Authorization: `Bearer ${basicsKey}` },
      });
      console.warn(`[MEETING:WS:HN] deepgram-key-gateway-response status=${res.status} t=${Date.now()}`);
      if (res.ok) {
        const data = (await res.json()) as { key?: string };
        if (data.key) {
          console.warn(`[MEETING:WS:HN] deepgram-key-resolved path=gateway_direct orgId=${organizationId} t=${Date.now()}`);
          return { key: data.key, gatewayUrl: null, basicsApiKey: basicsKey };
        }
      }
    } catch (err) {
      console.warn(`[MEETING:WS:HN] deepgram-key-gateway-error error=${err instanceof Error ? err.message : String(err)} t=${Date.now()}`);
    }

    // If gateway doesn't provide a key endpoint, use the Basics API key directly
    // and connect to Deepgram via the gateway WebSocket proxy
    console.warn(`[MEETING:WS:HN] deepgram-key-resolved path=gateway_ws_proxy orgId=${organizationId} t=${Date.now()}`);
    return { key: basicsKey, gatewayUrl: env.BASICSOS_API_URL, basicsApiKey: basicsKey };
  }

  console.warn(`[MEETING:WS:HN] deepgram-key-resolved path=none orgId=${organizationId} t=${Date.now()}`);
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
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const token = url.searchParams.get("token");
    const source = url.searchParams.get("source"); // "system" for ScreenCaptureKit
    const encoding = url.searchParams.get("encoding"); // "linear16" for raw PCM
    const sampleRate = url.searchParams.get("sample_rate"); // "16000"

    console.warn(`[MEETING:WS:HN] client-connect source=${source ?? "default"} encoding=${encoding ?? "webm"} sample_rate=${sampleRate ?? "auto"} t=${Date.now()}`);

    if (!token) {
      console.warn(`[MEETING:WS:HN] auth-fail reason=missing_token t=${Date.now()}`);
      sendToClient(clientWs, { type: "error", message: "Missing token" });
      clientWs.close();
      return;
    }

    void (async () => {
      const crmUser = await authenticateWs(db, auth, token);
      if (!crmUser || !crmUser.organizationId) {
        console.warn(`[MEETING:WS:HN] auth-fail reason=unauthorized userId=${crmUser?.userId ?? "none"} t=${Date.now()}`);
        sendToClient(clientWs, { type: "error", message: "Unauthorized" });
        clientWs.close();
        return;
      }
      console.warn(`[MEETING:WS:HN] auth-success userId=${crmUser.userId} orgId=${crmUser.organizationId} t=${Date.now()}`);

      const dgConfig = await resolveDeepgramConfig(
        db,
        env,
        crmUser.organizationId,
      );
      if (!dgConfig) {
        console.warn(`[MEETING:WS:HN] deepgram-key-fail reason=no_config orgId=${crmUser.organizationId} t=${Date.now()}`);
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
        console.warn(`[MEETING:WS:HN] deepgram-connect-url mode=gateway url=${dgUrl.split("?")[0]} t=${Date.now()}`);
      } else {
        dgUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
        dgAuthHeader = `Token ${dgConfig.key}`;
        console.warn(`[MEETING:WS:HN] deepgram-connect-url mode=direct url=wss://api.deepgram.com/v1/listen t=${Date.now()}`);
      }

      const tag = source === "system" ? "system" : "mixed";
      let closedByUs = false;
      let reconnectAttempt = 0;
      let totalReconnects = 0;
      let lastConnectTime = 0;
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
        console.warn(`[MEETING:WS:HN] deepgram-connecting tag=${tag} attempt=${reconnectAttempt} t=${Date.now()}`);
        const dgWs = new WsWebSocket(dgUrl, {
          headers: { Authorization: dgAuthHeader },
        } as ClientOptions);
        currentDgWs = dgWs;

        dgWs.on("open", () => {
          lastConnectTime = Date.now();
          console.warn(`[MEETING:WS:HN] deepgram-connected tag=${tag} reconnectAttempt=${reconnectAttempt} totalReconnects=${totalReconnects} t=${lastConnectTime}`);
          // Only reset consecutive counter if this isn't the initial connect
          // (reconnectAttempt resets happen in close handler based on stability)
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
            if (result.is_final) {
              console.warn(`[MEETING:WS:HN] transcript-final tag=${tag} dgMsg=${dgMsgCount} speaker=${speaker} is_final=${result.is_final} speech_final=${result.speech_final} text="${transcript.slice(0, 50)}" t=${Date.now()}`);
            }
            transcriptsSentCount++;
            console.warn(`[MEETING:WS:HN] transcript-forward tag=${tag} count=${transcriptsSentCount} is_final=${result.is_final} t=${Date.now()}`);
            sendToClient(clientWs, {
              type: "transcript",
              transcript,
              is_final: result.is_final ?? false,
              speech_final: result.speech_final ?? false,
              ...(speaker !== undefined ? { speaker } : {}),
            });
          } catch (err) {
            console.error(`[MEETING:WS:HN] deepgram-parse-error tag=${tag} error=${err instanceof Error ? err.message : String(err)} t=${Date.now()}`);
          }
        });

        dgWs.on("error", (err: Error) => {
          console.warn(`[MEETING:WS:HN] deepgram-error tag=${tag} error=${err.message ?? String(err)} t=${Date.now()}`);
          sendToClient(clientWs, {
            type: "error",
            message: "Deepgram connection error",
          });
        });

        dgWs.on("close", (code: number, reason: Buffer) => {
          clearKeepAlive();
          const connectionDuration = Date.now() - lastConnectTime;
          const wasStable = connectionDuration >= MIN_STABLE_CONNECTION_MS;
          console.warn(`[MEETING:WS:HN] deepgram-disconnect tag=${tag} code=${code} reason="${reason?.toString() ?? ""}" closedByUs=${closedByUs} connectionDurationMs=${connectionDuration} wasStable=${wasStable} totalReconnects=${totalReconnects} totalAudioChunks=${audioChunkCount} totalDgMsgs=${dgMsgCount} totalTranscriptsSent=${transcriptsSentCount} t=${Date.now()}`);
          if (closedByUs) return;

          // Only reset consecutive counter if the connection was stable (lived long enough)
          if (wasStable) {
            reconnectAttempt = 0;
          }

          // Check both consecutive and total limits
          if (totalReconnects >= MAX_TOTAL_RECONNECTS) {
            console.warn(`[MEETING:WS:HN] deepgram-reconnect-total-exhausted tag=${tag} totalReconnects=${totalReconnects} t=${Date.now()}`);
            sendToClient(clientWs, { type: "closed", reason: "max_total_retries" });
            return;
          }

          if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempt++;
            totalReconnects++;
            // Use longer backoff for unstable connections
            const backoffMultiplier = wasStable ? 1 : Math.min(totalReconnects, 5);
            const delay = BACKOFF_BASE_MS * Math.pow(2, reconnectAttempt - 1) * backoffMultiplier;
            console.warn(`[MEETING:WS:HN] deepgram-reconnect tag=${tag} attempt=${reconnectAttempt} maxAttempts=${MAX_RECONNECT_ATTEMPTS} totalReconnects=${totalReconnects} delayMs=${delay} t=${Date.now()}`);
            sendToClient(clientWs, {
              type: "reconnecting",
              attempt: reconnectAttempt,
            });
            reconnectTimeout = setTimeout(connectDeepgram, delay);
          } else {
            console.warn(`[MEETING:WS:HN] deepgram-reconnect-exhausted tag=${tag} attempts=${reconnectAttempt} totalReconnects=${totalReconnects} t=${Date.now()}`);
            sendToClient(clientWs, { type: "closed", reason: "max_retries" });
          }
        });
      };

      let audioChunkCount = 0;
      let transcriptsSentCount = 0;

      connectDeepgram();
      clientWs.on("message", (rawData, isBinary) => {
        if (isBinary) {
          audioChunkCount++;
          const size = Array.isArray(rawData) ? rawData.reduce((s, b) => s + b.length, 0) : (rawData as Buffer).length;
          if (audioChunkCount === 1) {
            console.warn(`[MEETING:WS:HN] audio-first-chunk tag=${tag} size=${size} t=${Date.now()}`);
          } else if (audioChunkCount % 200 === 0) {
            console.warn(`[MEETING:WS:HN] audio-chunk-progress tag=${tag} count=${audioChunkCount} size=${size} t=${Date.now()}`);
          }
          // Forward audio to Deepgram — convert RawData to Buffer
          if (currentDgWs?.readyState === WsWebSocket.OPEN) {
            const buf = Array.isArray(rawData)
              ? Buffer.concat(rawData)
              : rawData;
            currentDgWs.send(buf);
          } else {
            console.warn(`[MEETING:WS:HN] audio-chunk-dropped tag=${tag} count=${audioChunkCount} dgReadyState=${currentDgWs?.readyState ?? "null"} t=${Date.now()}`);
          }
          return;
        }

        // JSON control messages
        const data = rawData;
        try {
          const msg = JSON.parse(data.toString()) as { type: string };
          if (msg.type === "CloseStream") {
            const closeStreamReceivedAt = Date.now();
            console.warn(`[MEETING:WS:HN] closestream-received tag=${tag} totalAudioChunks=${audioChunkCount} t=${closeStreamReceivedAt}`);
            closedByUs = true;
            clearKeepAlive();
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = null;
            }
            if (currentDgWs?.readyState === WsWebSocket.OPEN) {
              console.warn(`[MEETING:WS:HN] closestream-forward-to-deepgram tag=${tag} t=${Date.now()}`);
              currentDgWs.send(JSON.stringify({ type: "CloseStream" }));
              // Wait for Deepgram to close, then send closed to client
              let closeAckSent = false;
              currentDgWs.once("close", () => {
                if (closeAckSent) return;
                closeAckSent = true;
                const elapsed = Date.now() - closeStreamReceivedAt;
                console.warn(`[MEETING:WS:HN] deepgram-close-ack tag=${tag} elapsedMs=${elapsed} t=${Date.now()}`);
                console.warn(`[MEETING:WS:HN] client-close-sent tag=${tag} totalAudioChunks=${audioChunkCount} totalTranscriptsSent=${transcriptsSentCount} t=${Date.now()}`);
                sendToClient(clientWs, { type: "closed" });
              });
              // Timeout fallback (5s — Deepgram typically acks in ~2s)
              setTimeout(() => {
                if (closeAckSent) return;
                closeAckSent = true;
                console.warn(`[MEETING:WS:HN] closestream-timeout-fallback tag=${tag} elapsedMs=${Date.now() - closeStreamReceivedAt} t=${Date.now()}`);
                sendToClient(clientWs, { type: "closed" });
              }, 5000);
            } else {
              console.warn(`[MEETING:WS:HN] closestream-dg-not-open tag=${tag} dgReadyState=${currentDgWs?.readyState ?? "null"} t=${Date.now()}`);
              console.warn(`[MEETING:WS:HN] client-close-sent tag=${tag} totalAudioChunks=${audioChunkCount} totalTranscriptsSent=${transcriptsSentCount} t=${Date.now()}`);
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
        console.warn(`[MEETING:WS:HN] client-disconnect tag=${tag} code=${code} reason="${reason?.toString() ?? ""}" totalAudioChunks=${audioChunkCount} totalTranscriptsSent=${transcriptsSentCount} t=${Date.now()}`);
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
