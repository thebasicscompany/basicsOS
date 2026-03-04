import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context, Next } from "hono";
import { createAuth } from "./auth.js";
import type { Db } from "./db/client.js";
import type { Env } from "./env.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createAutomationRunsRoutes } from "./routes/automation-runs.js";
import { createCrmRoutes } from "./routes/crm/index.js";
import { createCustomFieldRoutes } from "./routes/custom-fields.js";
import { createConnectionsRoutes } from "./routes/connections.js";
import { createGatewayChatRoutes } from "./routes/gateway-chat.js";
import { createObjectConfigRoutes } from "./routes/object-config.js";
import { createSchemaRoutes } from "./routes/schema.js";
import { createViewRoutes } from "./routes/views.js";
import { createVoiceProxyRoutes } from "./routes/voice-proxy.js";
import { createStreamAssistantRoutes } from "./routes/stream-assistant.js";
import { createRbacRoutes } from "./routes/rbac.js";

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
    path === "/api/signup" ||
    path === "/api/invites" ||
    path === "/api/gateway-chat" ||
    path === "/stream/assistant" ||
    path.startsWith("/v1/audio/")
  );
};

const rateLimitMiddleware = async (c: Context, next: Next): Promise<Response | void> => {
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
  const auth = createAuth(db, env.BETTER_AUTH_URL, env.BETTER_AUTH_SECRET);

  const app = new Hono();

  app.use(
    "/*",
    cors({
      origin: (origin) => {
        // Allow localhost on any port (web dev, Electron dev server)
        if (!origin) return null;
        try {
          const url = new URL(origin);
          const allowed =
            (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
            (url.protocol === "http:" || url.protocol === "https:");
          return allowed ? origin : null;
        } catch {
          return null;
        }
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
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
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:* https://localhost:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    await next();
  });

  app.use("/*", rateLimitMiddleware);

  app.get("/health", (c) => c.json({ status: "ok" }));


  // Better Auth
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  // Auth routes (signup, me)
  app.route("/api", createAuthRoutes(db, auth, env));

  // Connections (OAuth proxy to gateway) — before CRM generic routes
  app.route("/api/connections", createConnectionsRoutes(db, auth, env));

  // Gateway chat — must be before CRM so POST /api/:resource doesn't swallow it
  app.route("/api/gateway-chat", createGatewayChatRoutes(db, auth, env));

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

  // CRM REST API
  app.route("/api", createCrmRoutes(db, auth, env));

  // Voice pill BFF — /v1/audio/* and /stream/assistant
  app.route("/v1/audio", createVoiceProxyRoutes(db, auth, env));
  app.route("/stream", createStreamAssistantRoutes(db, auth, env));

  return app;
}
