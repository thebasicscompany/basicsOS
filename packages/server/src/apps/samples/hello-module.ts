import type { AppModule } from "@/apps/module-types.js";

// A sample backend AppModule (APP-4c). It registers one broker tool and one HTTP
// route, and demonstrates ScopedDb (it can read its OWN namespaced table but the
// loader guard forbids touching core tables). Loaded only when
// LOAD_SAMPLE_APP_MODULE=1 — production registries are empty unless a hosted app
// has been deployed (APP-4d).
export const helloModule: AppModule = {
  slug: "hello",
  version: "1.0.0",
  minBackendApiVersion: "1.0.0",

  registerTools(t) {
    t.register({
      name: "greet",
      description: "Return a greeting from the hello app.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "who to greet" } },
        additionalProperties: false,
      },
      handler: async (args, ctx) => {
        const name = (args as { name?: unknown })?.name;
        return {
          message: `Hello ${typeof name === "string" && name ? name : "world"}!`,
          tenant: ctx.tenantId,
          by: ctx.userId,
        };
      },
    });
  },

  registerRoutes(r) {
    r.get("/ping", async (_req, ctx) => ({
      status: 200,
      body: { ok: true, app: "hello", tenant: ctx.tenantId },
    }));
  },
};
