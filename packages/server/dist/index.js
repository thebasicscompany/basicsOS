import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createAuth } from "./auth.js";
import { createDb } from "./db/client.js";
import { getEnv } from "./env.js";
import { startAutomationEngine, stopAutomationEngine, } from "./lib/automation-engine.js";
import { startEmailSyncEngine, stopEmailSyncEngine, } from "./lib/email-sync/sync-engine.js";
import { logger } from "./lib/logger.js";
import { attachTranscribeWs } from "./ws/transcribe.js";
const log = logger.child({ component: "server" });
async function main() {
    const env = getEnv();
    const { db, close } = createDb(env.DATABASE_URL);
    const app = createApp(db, env);
    const allowedOrigins = env.ALLOWED_ORIGINS
        ? env.ALLOWED_ORIGINS.split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : [];
    const auth = createAuth(db, env.BETTER_AUTH_URL, env.BETTER_AUTH_SECRET, allowedOrigins, env);
    const server = serve({
        fetch: app.fetch,
        port: env.PORT,
    }, (info) => {
        log.info({ port: info.port, authUrl: `${env.BETTER_AUTH_URL}/api/auth/*` }, "HTTP server listening");
    });
    // Attach WebSocket server for real-time transcription
    attachTranscribeWs(server, db, auth, env);
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        log.info({ signal }, "Shutdown requested");
        await new Promise((resolve) => {
            server.close(() => {
                log.info("HTTP server closed");
                resolve();
            });
        });
        await stopAutomationEngine();
        await stopEmailSyncEngine();
        await close();
        process.exit(0);
    };
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
    startAutomationEngine(db, env).catch((err) => {
        log.error({ err }, "Automation engine failed to start");
    });
    startEmailSyncEngine(db, env).catch((err) => {
        log.error({ err }, "Email sync engine failed to start");
    });
}
main().catch((err) => {
    log.error({ err }, "Server failed to start");
    process.exit(1);
});
