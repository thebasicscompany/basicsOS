// Module loader (APP-4c). Wires each installed AppModule's registered routes,
// jobs, and tools into namespaced artifacts the host mounts. Isolation is
// structural: tools become `app.{slug}.{name}`, routes mount under
// /apps/{slug}/api/*, jobs are `app:{slug}:*`, and every tool/route handler runs
// against the module's ScopedDb (org-filtered, core tables denied). See B.5 / C.7.

import type { BrokerTool, ToolCallContext } from "@/mcp-broker/protocol.js";
import type {
  AppContext,
  AppModule,
  AppRouteHandler,
  AppRouter,
  JobRegistrar,
  LoadedModule,
  ToolRegistrar,
} from "@/apps/module-types.js";

/** Build a per-invocation AppContext for a module from the resolved broker ctx. */
export type AppContextFactory = (slug: string, ctx: ToolCallContext) => AppContext;

/** Load one module into namespaced tools/routes/jobs. */
export function loadModule(module: AppModule, makeContext: AppContextFactory): LoadedModule {
  const tools: BrokerTool[] = [];
  const routes = new Map<string, AppRouteHandler>();
  const jobs = new Map<string, (data: unknown, ctx: AppContext) => Promise<void>>();

  if (module.registerTools) {
    const reg: ToolRegistrar = {
      register(def) {
        tools.push({
          name: `app.${module.slug}.${def.name}`,
          description: def.description,
          inputSchema: def.inputSchema,
          meta: { source: "app", writes: Boolean(def.writes) },
          handle: async (args, ctx) => {
            const appCtx = makeContext(module.slug, ctx);
            return def.handler(args, { ...appCtx, userId: String(ctx.crmUserId ?? "") });
          },
        });
      },
    };
    module.registerTools(reg);
  }

  if (module.registerRoutes) {
    const norm = (p: string) => (p.startsWith("/") ? p : `/${p}`);
    const router: AppRouter = {
      get: (p, h) => routes.set(`GET ${norm(p)}`, h),
      post: (p, h) => routes.set(`POST ${norm(p)}`, h),
      put: (p, h) => routes.set(`PUT ${norm(p)}`, h),
      delete: (p, h) => routes.set(`DELETE ${norm(p)}`, h),
    };
    module.registerRoutes(router);
  }

  if (module.registerJobs) {
    const jr: JobRegistrar = {
      register: (name, h) => jobs.set(`app:${module.slug}:${name}`, h),
    };
    module.registerJobs(jr);
  }

  return { slug: module.slug, version: module.version, tools, routes, jobs };
}

export function loadModules(modules: AppModule[], makeContext: AppContextFactory): LoadedModule[] {
  return modules.map((m) => loadModule(m, makeContext));
}

/** All app-contributed broker tools across loaded modules (for the manifest). */
export function appToolsFor(loaded: LoadedModule[]): BrokerTool[] {
  return loaded.flatMap((m) => m.tools);
}
