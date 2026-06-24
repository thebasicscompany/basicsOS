// App-module host wiring (APP-4c). Builds the per-invocation AppContext factory
// (ScopedDb + gateway + broker + secrets + logger), loads the installed modules,
// and exposes their broker tools + a Hono router for their HTTP routes. Kept
// separate from app.ts so the boot path stays readable.

import { Hono } from "hono";
import type { Db, RawSql } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import { logger } from "@/lib/logger.js";
import type { BrokerTool, ToolCallContext } from "@/mcp-broker/protocol.js";
import { authMiddleware } from "@/middleware/auth.js";
import { getCrmUserFromSession } from "@/lib/rbac.js";
import { createScopedDb } from "@/apps/scoped-db.js";
import { loadModules, appToolsFor, type AppContextFactory } from "@/apps/module-loader.js";
import { getInstalledModules } from "@/apps/registry.js";
import type { AppContext, LoadedModule, SecretStore } from "@/apps/module-types.js";

const log = logger.child({ component: "app-modules" });

/** Fail-closed secret store until per-app encryption (APP_SECRET_ENCRYPTION_KEY)
 *  is wired. Reads return null; writes refuse, so a module can't silently persist
 *  plaintext secrets. */
function makeSecretStore(): SecretStore {
  return {
    get: async () => null,
    set: async () => {
      throw new Error("Per-app secret storage is not configured (APP_SECRET_ENCRYPTION_KEY).");
    },
  };
}

export interface AppModuleHost {
  loadedModules: LoadedModule[];
  /** Broker tools contributed by modules, named app.{slug}.{tool}. */
  appTools: BrokerTool[];
  /** Wire module→broker calls once the broker core exists (avoids a cycle). */
  bindBroker(getTools: () => Promise<BrokerTool[]>): void;
  /** A Hono app mounting each module's routes under /apps/{slug}/api/*. */
  routes(auth: ReturnType<typeof createAuth>): Hono;
}

export function buildAppModuleHost(db: Db, sql: RawSql, env: Env): AppModuleHost {
  let brokerGetTools: (() => Promise<BrokerTool[]>) | null = null;

  const makeContext: AppContextFactory = (slug, ctx: ToolCallContext): AppContext => ({
    tenantId: ctx.orgId,
    db: createScopedDb(sql, ctx.orgId, slug),
    gateway: {
      fetch: (path, init) =>
        fetch(`${env.BASICSOS_API_URL}${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${env.SERVER_BASICS_API_KEY ?? ""}`,
            ...(init?.headers ?? {}),
          },
        }),
    },
    broker: {
      call: async (toolName, args) => {
        if (!brokerGetTools) throw new Error("broker not bound");
        const tool = (await brokerGetTools()).find((t) => t.name === toolName);
        if (!tool) throw new Error(`Unknown tool: ${toolName}`);
        // Module→broker calls run under the same acting context (RBAC enforced).
        return tool.handle(args, ctx);
      },
    },
    secrets: makeSecretStore(),
    logger: log,
  });

  const loadedModules = loadModules(getInstalledModules(env), makeContext);
  if (loadedModules.length) {
    log.info({ modules: loadedModules.map((m) => `${m.slug}@${m.version}`) }, "loaded app modules");
  }

  return {
    loadedModules,
    appTools: appToolsFor(loadedModules),
    bindBroker: (getTools) => {
      brokerGetTools = getTools;
    },
    routes: (auth) => {
      const app = new Hono();
      app.use("*", authMiddleware(auth, db));
      for (const mod of loadedModules) {
        for (const [methodPath, handler] of mod.routes) {
          const [method, path] = methodPath.split(" ", 2);
          // Mounted at /apps/{slug}/api{path} (the router prefix adds /apps).
          const fullPath = `/${mod.slug}/api${path}`;
          const wired = async (c: import("hono").Context) => {
            const crmUser = await getCrmUserFromSession(c, db);
            if (!crmUser || !crmUser.organizationId) {
              return c.json({ error: "Unauthorized" }, 401);
            }
            const ctx: ToolCallContext = {
              orgId: crmUser.organizationId,
              crmUserId: crmUser.id,
              sessionKey: null,
              permissions: new Set(),
              can: () => false,
              meta: { surface: "app-module", appSlug: mod.slug },
              appGrants: [],
            };
            const appCtx = makeContext(mod.slug, ctx);
            const res = await handler(
              {
                method,
                path,
                query: c.req.query(),
                json: () => c.req.json(),
              },
              { ...appCtx, userId: String(crmUser.id) },
            );
            return c.json((res?.body ?? null) as never, (res?.status ?? 200) as never);
          };
          if (method === "GET") app.get(fullPath, wired);
          else if (method === "POST") app.post(fullPath, wired);
          else if (method === "PUT") app.put(fullPath, wired);
          else if (method === "DELETE") app.delete(fullPath, wired);
        }
      }
      return app;
    },
  };
}
