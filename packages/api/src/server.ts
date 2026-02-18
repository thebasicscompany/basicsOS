import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { corsMiddleware } from "./middleware/cors.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { appRouter } from "./routers/index.js";
import { createContext } from "./context.js";

export const createApp = (): Hono => {
  const app = new Hono();

  // Middleware chain order matters
  app.use("*", corsMiddleware);
  app.use("*", rateLimitMiddleware);

  // Health check — no auth required
  app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

  // tRPC routes — auth + tenant context injected per-request via createContext
  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: (opts) => createContext(opts),
      onError: ({ error, path }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error(`tRPC error on ${path}:`, error);
        }
      },
    }),
  );

  return app;
};
