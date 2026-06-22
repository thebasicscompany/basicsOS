import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Context, Next } from "hono";
import { createAuth } from "@/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import { createAuthRoutes } from "@/routes/auth.js";
import { createAutomationRunsRoutes } from "@/routes/automation-runs.js";
import { createCrmRoutes } from "@/routes/crm/index.js";
import { createCustomFieldRoutes } from "@/routes/custom-fields.js";
import { createConnectionsRoutes } from "@/routes/connections.js";
import { createGatewayChatRoutes } from "@/routes/gateway-chat.js";
import { createAgentChatRoutes } from "@/routes/agent-chat.js";
import { createFilesRoutes } from "@/routes/files.js";
import { createMeRoutes } from "@/routes/me.js";
import { createObjectConfigRoutes } from "@/routes/object-config.js";
import { createSchemaRoutes } from "@/routes/schema.js";
import { createViewRoutes } from "@/routes/views.js";
import { createVoiceProxyRoutes } from "@/routes/voice-proxy.js";
import { createStreamAssistantRoutes } from "@/routes/stream-assistant.js";
import { createThreadsRoutes } from "@/routes/threads.js";
import { createMeetingsRoutes } from "@/routes/meetings.js";
import { createNotificationsRoutes } from "@/routes/notifications.js";
import { createSlackEventsRoutes } from "@/routes/slack-events.js";
import { createEmailSyncRoutes } from "@/routes/email-sync.js";
import { createRbacRoutes } from "@/routes/rbac.js";
import { createAdminRoutes } from "@/routes/admin.js";
import { createApiTokensRoutes } from "@/routes/api-tokens.js";
import { createBrokerRoutes } from "@/mcp-broker/route.js";
import { isTrustedOrigin, isElectronUserAgent } from "@/lib/trusted-origins.js";
import { sql } from "drizzle-orm";

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

const getClientKey = (c: Context): string => {
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  const realIp = c.req.header("x-real-ip");
  return realIp?.trim() || "unknown";
};

const isSensitivePath = (path: string): boolean => {
  return (
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/auth-code") ||
    path === "/api/signup" ||
    path.startsWith("/api/invites") ||
    path === "/api/init" ||
    path === "/api/gateway-chat" ||
    path === "/stream/assistant" ||
    path.startsWith("/v1/audio/")
  );
};

const rateLimitMiddleware = async (
  c: Context,
  next: Next,
): Promise<Response | void> => {
  const now = Date.now();
  const path = c.req.path;
  const clientKey = getClientKey(c);
  const windowMs = 60_000;
  const max = isSensitivePath(path) ? 30 : 180;
  const bucketKey = `${clientKey}:${path}`;
  const current = rateBuckets.get(bucketKey);

  if (!current || now >= current.resetAt) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
  } else {
    current.count += 1;
    rateBuckets.set(bucketKey, current);
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too many requests" }, 429);
    }
  }

  for (const [key, value] of rateBuckets) {
    if (value.resetAt <= now) rateBuckets.delete(key);
  }

  await next();
};

export function createApp(db: Db, env: Env) {
  const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : [];
  const auth = createAuth(
    db,
    env.BETTER_AUTH_URL,
    env.BETTER_AUTH_SECRET,
    allowedOrigins,
    env,
  );

  const app = new Hono();

  const allowedOriginSet = new Set(allowedOrigins);

  app.use(
    "/*",
    cors({
      origin: (origin, c) => {
        const userAgent = c.req.header("user-agent");
        const effectiveOrigin =
          origin !== undefined && origin !== ""
            ? origin
            : isElectronUserAgent(userAgent)
              ? "null"
              : undefined;
        return effectiveOrigin && isTrustedOrigin(effectiveOrigin, allowedOriginSet, userAgent)
          ? effectiveOrigin
          : null;
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  app.use("/*", async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    c.header("Cross-Origin-Opener-Policy", "same-origin");
    c.header("Cross-Origin-Resource-Policy", "same-site");
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:* https://localhost:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    await next();
  });

  // MCP Tool Broker (hermes connects here over Streamable HTTP). Mounted BEFORE
  // the rate limiter so the agent's tool-call bursts aren't throttled; it has its
  // own bearer auth (BROKER_INSTANCE_TOKEN). See src/mcp-broker/.
  app.route("/", createBrokerRoutes(db, env));

  app.use("/*", rateLimitMiddleware);

  app.get("/", (c) =>
    c.json({
      name: "BasicsOS API",
      health: "/health",
      docs: "https://www.basicsos.com/docs/self-hosted-crm/introduction",
    }),
  );
  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/health/ready", async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({ status: "ok" });
    } catch {
      return c.json(
        { status: "unhealthy", error: "Database unreachable" },
        503,
      );
    }
  });

  // Better Auth
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  // Auth routes (signup, me)
  app.route("/api", createAuthRoutes(db, auth, env));

  // Connections (OAuth proxy to gateway) — before CRM generic routes
  app.route("/api/connections", createConnectionsRoutes(db, auth, env));

  // Gateway chat — must be before CRM so POST /api/:resource doesn't swallow it
  app.route("/api/gateway-chat", createGatewayChatRoutes(db, auth, env));

  // Hermes-backed chat (replaces the in-process brain). Same wire format + thread
  // persistence as gateway-chat; the UI hook posts here. See routes/agent-chat.ts.
  app.route("/api/agent-chat", createAgentChatRoutes(db, auth, env));

  // Download files the agent generated (per-thread, ownership-scoped).
  app.route("/api/files", createFilesRoutes(db, auth, env));

  // Per-user / org timezone (for scheduled automations).
  app.route("/api/me", createMeRoutes(db, auth, env));

  // Thread list & message history
  app.route("/api/threads", createThreadsRoutes(db, auth, env));

  // Meeting recordings
  app.route("/api/meetings", createMeetingsRoutes(db, auth, env));

  // Pill notifications SSE stream
  app.route("/api/notifications", createNotificationsRoutes(db, auth, env));

  // Slack Events API (webhook — no auth middleware)
  app.route("/api/slack", createSlackEventsRoutes(db, auth, env));

  // Email sync + contact discovery
  app.route("/api/email-sync", createEmailSyncRoutes(db, auth, env));

  // Automation runs — must be before CRM generic routes
  app.route("/api/automation-runs", createAutomationRunsRoutes(db, auth, env));

  // Custom field definitions
  app.route("/api/custom_field_defs", createCustomFieldRoutes(db, auth));

  // Object configuration + favorites
  app.route("/api/object-config", createObjectConfigRoutes(db, auth, env));

  // Schema introspection (before CRM so /api/schema/:tableName is not captured)
  app.route("/api/schema", createSchemaRoutes(db, auth));

  // View persistence (before CRM so /api/views/* is not captured)
  app.route("/api/views", createViewRoutes(db, auth));

  // RBAC management APIs
  app.route("/api/rbac", createRbacRoutes(db, auth));

  // Admin APIs (AI config, usage tracking)
  app.route("/api/admin", createAdminRoutes(db, auth, env));

  // Personal CRM API tokens (before generic /api/:resource CRM routes)
  app.route("/api/api-tokens", createApiTokensRoutes(db, auth, env));

  // CRM REST API
  app.route("/api", createCrmRoutes(db, auth, env));

  // Voice pill BFF — /v1/audio/* and /stream/assistant
  app.route("/v1/audio", createVoiceProxyRoutes(db, auth, env));
  app.route("/stream", createStreamAssistantRoutes(db, auth, env));

  // Serve static frontend when STATIC_DIR is set (combined web + API deployment)
  const staticDir = env.STATIC_DIR;
  if (staticDir) {
    app.use("/*", serveStatic({ root: staticDir }));
    app.get("*", (c) => {
      const indexPath = join(staticDir, "index.html");
      if (existsSync(indexPath)) {
        return c.html(readFileSync(indexPath, "utf8"));
      }
      return c.json({ error: "Not found" }, 404);
    });
  }

  return app;
}
