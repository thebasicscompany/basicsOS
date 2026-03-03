import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth.js";
import type { Db } from "./db/client.js";
import type { Env } from "./env.js";
import { createAssistantRoutes } from "./routes/assistant.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createAutomationRunsRoutes } from "./routes/automation-runs.js";
import { createCrmRoutes } from "./routes/crm.js";
import { createCustomFieldRoutes } from "./routes/custom-fields.js";
import { createConnectionsRoutes } from "./routes/connections.js";
import { createGatewayChatRoutes } from "./routes/gateway-chat.js";
import { createObjectConfigRoutes } from "./routes/object-config.js";
import { createSchemaRoutes } from "./routes/schema.js";
import { createViewRoutes } from "./routes/views.js";

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
      allowHeaders: ["Content-Type", "Authorization", "x-basics-api-key"],
      credentials: true,
    })
  );

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

  // CRM REST API
  app.route("/api", createCrmRoutes(db, auth, env));

  // Assistant
  app.route("/assistant", createAssistantRoutes(db, auth, env));

  return app;
}
