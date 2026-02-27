import { createApp } from "./server.js";
import { registerAuditLogger } from "./events/subscribers/audit-logger.js";
import { registerAutomationListener } from "./events/subscribers/automation-listener.js";
import { registerNotificationDispatcher } from "./events/subscribers/notification-dispatcher.js";
import {
  startMeetingProcessorWorker,
  registerMeetingProcessorListener,
} from "./workers/meeting-processor.worker.js";
import { startNotificationWorker } from "./workers/notification.worker.js";
import { registerAiEmployeeWorker } from "./workers/ai-employee.worker.js";
import { startEmbeddingWorker, registerEmbeddingListener } from "./workers/embedding.worker.js";
import { startAutomationExecutorWorker } from "./workers/automation-executor.worker.js";
import { createLogger } from "@basicsos/shared";
import { auth } from "@basicsos/auth";
import { createDeepgramStream } from "./lib/deepgram-streaming.js";
import type { ServerWebSocket } from "bun";

const logger = createLogger("api");

const port = Number(process.env["PORT"] ?? "3001");

// Register event subscribers before starting the server
registerAuditLogger();
registerAutomationListener();
registerNotificationDispatcher();
registerMeetingProcessorListener();
registerEmbeddingListener();
startMeetingProcessorWorker();
startNotificationWorker();
startEmbeddingWorker();
registerAiEmployeeWorker();
startAutomationExecutorWorker();

const app = createApp();

// ---------------------------------------------------------------------------
// WebSocket data attached during upgrade
// ---------------------------------------------------------------------------
type WsData = {
  meetingId: string;
  dgStream: ReturnType<typeof createDeepgramStream> | null;
};

const isDev = process.env["NODE_ENV"] !== "production";

// Bun's native HTTP server — handles both HTTP (via Hono) and WebSocket upgrades.
Bun.serve<WsData>({
  port,

  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade for streaming transcription
    if (url.pathname === "/ws/transcribe") {
      // Auth: Bearer token in query param (WebSocket doesn't support custom headers from browser)
      const token = url.searchParams.get("token");
      const meetingId = url.searchParams.get("meetingId");

      if (!meetingId) {
        return new Response("Missing meetingId query parameter", { status: 400 });
      }

      // Validate session token
      if (token) {
        const session = await auth.api
          .getSession({ headers: new Headers({ Authorization: `Bearer ${token}` }) })
          .catch(() => null);
        if (!session?.user && !isDev) {
          return new Response("Unauthorized", { status: 401 });
        }
      } else if (!isDev) {
        return new Response("Unauthorized — token required", { status: 401 });
      }

      const upgraded = server.upgrade(req, {
        data: { meetingId, dgStream: null },
      });

      return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 500 });
    }

    // All other requests → Hono
    return app.fetch(req);
  },

  websocket: {
    open(ws: ServerWebSocket<WsData>) {
      console.log(`[ws/transcribe] Client connected for meeting: ${ws.data.meetingId}`);

      // Create the Deepgram streaming proxy
      ws.data.dgStream = createDeepgramStream(
        { send: (data) => { try { ws.send(data); } catch { /* client disconnected */ } } },
        () => { console.log(`[ws/transcribe] Deepgram stream closed for meeting: ${ws.data.meetingId}`); },
      );
    },

    message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
      if (!ws.data.dgStream) return;

      // Binary frame → forward audio to Deepgram
      if (typeof message !== "string") {
        ws.data.dgStream.sendAudio(message);
        return;
      }

      // JSON control messages from client
      try {
        const parsed = JSON.parse(message) as { type: string };
        if (parsed.type === "KeepAlive") {
          ws.data.dgStream.keepAlive();
        } else if (parsed.type === "CloseStream") {
          ws.data.dgStream.close();
        }
      } catch {
        // Not JSON — ignore
      }
    },

    close(ws: ServerWebSocket<WsData>) {
      console.log(`[ws/transcribe] Client disconnected for meeting: ${ws.data.meetingId}`);
      ws.data.dgStream?.close();
      ws.data.dgStream = null;
    },
  },
});

logger.info({ port }, "Basics OS API server running (HTTP + WebSocket)");
