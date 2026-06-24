// The backend plugin / module contract (APP-4c), implementing CONTRACTS Part B.5.
//
// A hosted app that needs server logic ships an AppModule the company server loads
// from a registry at boot. It ADDS capability — namespaced routes, jobs, and tools —
// and never edits core files, so the base template stays upgradeable. Isolation is
// structural: routes/jobs/tools are namespaced per app, ScopedDb is org-filtered and
// denies core-table access, and secrets are per-app.

import type { BrokerTool } from "@/mcp-broker/protocol.js";

/** JSON Schema for a tool's input (kept loose to match BrokerTool.inputSchema). */
type JsonSchema = Record<string, unknown>;

/** A guarded DB accessor handed to a module: org-filtered, core tables denied. */
export interface ScopedDb {
  /** The owning org (every read/write is implicitly scoped to it). */
  readonly tenantId: string;
  /**
   * Run a parameterized SQL query against the app's OWN namespaced tables
   * (`app_{slug}_*`). Throws if the SQL references a core table — modules cannot
   * read or write core data directly; they use the broker for that.
   */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/** Per-app encrypted secret store. */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** Calls api.basicsos.com with the tenant's key (LLM, embeddings, usage). */
export interface GatewayClient {
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

/** Call other broker tools, permission-gated by the app's grants. */
export interface BrokerClient {
  call(toolName: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface Logger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface AppContext {
  tenantId: string;
  db: ScopedDb; // org-filtered; cannot touch core tables except via provided accessors
  gateway: GatewayClient;
  broker: BrokerClient; // permission-gated by the app's grants
  secrets: SecretStore;
  logger: Logger;
}

/** Minimal Hono-like router surface a module registers routes on. */
export interface AppRouter {
  get(path: string, handler: AppRouteHandler): void;
  post(path: string, handler: AppRouteHandler): void;
  put(path: string, handler: AppRouteHandler): void;
  delete(path: string, handler: AppRouteHandler): void;
}

export type AppRouteHandler = (req: AppRequest, ctx: AppContext & { userId: string | null }) => Promise<AppResponse> | AppResponse;

export interface AppRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  json(): Promise<unknown>;
}

export interface AppResponse {
  status?: number;
  body?: unknown;
}

export interface JobRegistrar {
  /** Register a recurring/queued job; the job name is namespaced `app:{slug}:{name}`. */
  register(name: string, handler: (data: unknown, ctx: AppContext) => Promise<void>): void;
}

export interface ToolRegistrar {
  register(def: {
    name: string; // becomes app.{slug}.{name} in the broker manifest
    description: string;
    inputSchema: JsonSchema;
    writes?: boolean;
    handler: (args: unknown, ctx: AppContext & { userId: string }) => Promise<unknown>;
  }): void;
}

export interface AppModule {
  slug: string;
  version: string; // semver
  minBackendApiVersion: string;

  registerRoutes?(r: AppRouter): void;
  registerJobs?(j: JobRegistrar): void;
  registerTools?(t: ToolRegistrar): void;

  onInstall?(ctx: AppContext): Promise<void>;
  onUpgrade?(ctx: AppContext, fromVersion: string): Promise<void>;
  onUninstall?(ctx: AppContext): Promise<void>;
}

/** Output of loading a module: wired artifacts the host mounts. */
export interface LoadedModule {
  slug: string;
  version: string;
  /** Broker tools, named `app.{slug}.{tool}`, ready to merge into the manifest. */
  tools: BrokerTool[];
  /** Registered route handlers, keyed by `METHOD /path` (mounted under /apps/{slug}/api). */
  routes: Map<string, AppRouteHandler>;
  /** Registered job handlers, keyed by namespaced job name. */
  jobs: Map<string, (data: unknown, ctx: AppContext) => Promise<void>>;
}
