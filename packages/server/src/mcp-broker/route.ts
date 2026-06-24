// Hono mount for the MCP Broker. hermes connects here over Streamable HTTP
// (POST /mcp). The instance is authenticated with a static bearer
// (BROKER_INSTANCE_TOKEN); per-user identity arrives per-call in tools/call
// params._meta (M4). POST is request/response; we ALSO expose the optional
// server->client SSE stream (GET /mcp) to push notifications/tools/list_changed
// when the tool surface changes (auto-reload — see tool-change-bus.ts).
//
// The tool registry + per-call enforcement live in a shared `BrokerCore`
// (createBrokerCore) so the SAME tool set, cache, and live-reload invalidator
// back BOTH the hermes `/mcp` path (here) and the Better-Auth app-facing path
// (app-route.ts, APP-0). Sharing one core is required: `setToolCacheInvalidator`
// is a single global slot, so there must be exactly one cache to invalidate.

import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { and, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import { logger } from "@/lib/logger.js";
import * as schema from "@/db/schema/index.js";
import { getPermissionSetForUser, hasPermission } from "@/lib/rbac.js";
import { normalizeGrants } from "@/mcp-broker/app-grants.js";
import { resolveSingleOrgId } from "@/mcp-broker/data.js";
import {
  handleRpc,
  type BrokerDeps,
  type BrokerTool,
  type JsonRpcRequest,
  type ToolCallContext,
} from "@/mcp-broker/protocol.js";
import { buildTools, buildCustomObjectTools } from "@/mcp-broker/tools.js";
import { streamSSE } from "hono/streaming";
import { addToolStreamClient, setToolCacheInvalidator } from "@/mcp-broker/tool-change-bus.js";

const log = logger.child({ component: "mcp-broker" });

/**
 * Extract the acting crm user id from a session key of the form
 * `agent:main:basicsos:dm:{crmUserId}:{threadId}` (built by lib/hermes/client).
 * Returns null if the shape/id doesn't parse.
 */
function parseActingUserId(sessionKey: string): number | null {
  const parts = sessionKey.split(":");
  if (parts.length < 6 || parts[3] !== "dm") return null;
  const id = Number(parts[4]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * If this session is an APP-ORIGINATED agent turn (thread `app-{slug}`, created by
 * POST /api/apps/:slug/agent), return the app slug. Such turns must be gated to the
 * app's grants, not the user's full surface (security: agent.invoke must not escape
 * the per-app sandbox). Returns null for ordinary chat/automation threads.
 */
function parseAppThreadSlug(sessionKey: string): string | null {
  const parts = sessionKey.split(":");
  if (parts.length < 6 || parts[3] !== "dm") return null;
  const threadId = parts.slice(5).join(":");
  return threadId.startsWith("app-") ? threadId.slice(4) : null;
}

/**
 * An OBJECT-SCOPED chat turn (thread `scope:{slug}:…`, created by a per-object /
 * per-record chat panel). Such turns are deterministically restricted to that one
 * object's tools — so "add a vendor" can ONLY hit object.vendors.create, never a
 * built-in like companies/leads (the model's object-conflation problem). Returns
 * the scoped object slug, or null for ordinary threads.
 */
function parseScopeThreadSlug(sessionKey: string): string | null {
  const parts = sessionKey.split(":");
  if (parts.length < 7 || parts[3] !== "dm") return null;
  // threadId = parts.slice(5) → ["scope", "{slug}", ...rest]
  return parts[5] === "scope" && parts[6] ? parts[6] : null;
}

/**
 * The shared broker engine: the org's live tool set (static + custom-object
 * tools, cached) and the two context resolvers. Built ONCE per server and shared
 * by the hermes `/mcp` route and the app-facing route, so both see the same tool
 * surface and the single live-reload cache invalidator.
 */
export interface BrokerCore {
  /** Live tool set for this org: static tools + custom-object tools (cached). */
  getTools: () => Promise<BrokerTool[]>;
  /** The single company/org this hermes instance serves (resolved + cached). */
  getOrgId: () => Promise<string>;
  /** Resolve the acting context from a hermes tools/call `_meta` block. */
  resolveHermesContext: (meta: Record<string, unknown> | null) => Promise<ToolCallContext>;
  logError: (err: unknown, context: string) => void;
}

export function createBrokerCore(db: Db, env: Env, appTools: BrokerTool[] = []): BrokerCore {
  const staticTools = buildTools(db, env);

  // One company per hermes instance — resolve the org id once, lazily, and cache.
  let orgIdPromise: Promise<string> | null = null;
  const getOrgId = () => (orgIdPromise ??= resolveSingleOrgId(db));

  // Tool set = static tools + this org's CUSTOM-object tools (generated from
  // object_config). Cached with a short TTL to avoid a DB query per call; a
  // tool-surface change invalidates the cache (below) and we push
  // notifications/tools/list_changed over the GET /mcp SSE stream so hermes
  // re-fetches live (listChanged:true in initialize).
  let toolsCache: { at: number; tools: BrokerTool[] } | null = null;
  const TOOLS_TTL_MS = 60_000;
  const getTools = async (): Promise<BrokerTool[]> => {
    const now = Date.now();
    if (toolsCache && now - toolsCache.at < TOOLS_TTL_MS) return toolsCache.tools;
    let custom: BrokerTool[] = [];
    try {
      custom = await buildCustomObjectTools(db, await getOrgId());
    } catch (err) {
      log.error({ err }, "failed to build custom-object tools; serving static set only");
    }
    // static + this org's custom-object tools + backend app-module tools (APP-4c).
    const tools = [...staticTools, ...custom, ...appTools];
    toolsCache = { at: now, tools };
    return tools;
  };
  // A tool-surface change (grid/field add/remove) drops the cache so the next
  // tools/list is freshly generated for this org.
  setToolCacheInvalidator(() => {
    toolsCache = null;
  });

  const resolveHermesContext = async (
    meta: Record<string, unknown> | null,
  ): Promise<ToolCallContext> => {
    const orgId = await getOrgId();
    // The trusted session key arrives in _meta (set by our hermes patch from
    // X-Hermes-Session-Key — never a model argument). Resolve the acting user
    // + permissions from it. Reads stay org-scoped even without a user.
    const sessionKey =
      (meta?.current_session_key as string | undefined) ??
      (meta?.["hermes/session_key"] as string | undefined) ??
      null;

    let crmUserId: number | null = null;
    let permissions = new Set<string>();
    const acting = sessionKey ? parseActingUserId(sessionKey) : null;
    if (acting != null) {
      const [crmUser] = await db
        .select()
        .from(schema.crmUsers)
        .where(
          and(
            eq(schema.crmUsers.id, acting),
            eq(schema.crmUsers.organizationId, orgId),
            eq(schema.crmUsers.disabled, false), // mirror middleware/auth.ts: a disabled user gets no access
          ),
        )
        .limit(1);
      if (crmUser) {
        crmUserId = crmUser.id;
        permissions = await getPermissionSetForUser(db, crmUser);
      }
    }

    // App-originated agent turn → gate this turn's tool calls to the app's grants
    // (so agent.invoke can't escape the per-app sandbox). Fail closed: an app thread
    // whose app is missing/suspended gets an empty grant set (nothing callable).
    let appGrants: readonly string[] | null = null;

    // Object-scoped chat → restrict this turn to ONE object's tools + context/
    // memory. The agent literally cannot call another object's tools, so record
    // ops can't mis-route (deterministic fix for vendor↔lead↔company conflation).
    const scopeSlug = sessionKey ? parseScopeThreadSlug(sessionKey) : null;
    if (scopeSlug != null) {
      return {
        orgId,
        crmUserId,
        sessionKey,
        permissions,
        can: (p: string) => hasPermission(permissions, p),
        meta: meta ?? null,
        appGrants: [`object.${scopeSlug}.*`, "context.*", "memory.*"],
      };
    }

    const appSlug = sessionKey ? parseAppThreadSlug(sessionKey) : null;
    if (appSlug != null) {
      const [row] = await db
        .select({ permissions: schema.appConfig.permissions, status: schema.appConfig.status })
        .from(schema.appConfig)
        .where(
          and(
            eq(schema.appConfig.slug, appSlug),
            or(
              eq(schema.appConfig.organizationId, orgId),
              isNull(schema.appConfig.organizationId),
            ),
          ),
        )
        .limit(1);
      appGrants = row && row.status !== "suspended" ? normalizeGrants(row.permissions) : [];
    }

    return {
      orgId,
      crmUserId,
      sessionKey,
      permissions,
      can: (p: string) => hasPermission(permissions, p),
      meta: meta ?? null,
      appGrants,
    };
  };

  return {
    getTools,
    getOrgId,
    resolveHermesContext,
    logError: (err, context) => log.error({ err }, context),
  };
}

export function createBrokerRoutes(core: BrokerCore, env: Env) {
  const app = new Hono();

  const deps: BrokerDeps = {
    getTools: core.getTools,
    resolveContext: core.resolveHermesContext,
    logError: core.logError,
  };

  const isAuthed = (c: Context): boolean => {
    const expected = env.BROKER_INSTANCE_TOKEN;
    if (!expected) {
      log.error("BROKER_INSTANCE_TOKEN is not set — refusing all MCP requests");
      return false;
    }
    const header = c.req.header("authorization") ?? "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token) return false;
    // Constant-time compare over SHA-256 digests (fixed length → no length leak).
    const a = createHash("sha256").update(token).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
  };

  app.post("/mcp", async (c) => {
    if (!isAuthed(c)) {
      return c.json(
        { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
        401,
      );
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
        400,
      );
    }

    const messages = Array.isArray(body) ? body : [body];
    if (messages.length > 50) {
      return c.json(
        { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Batch too large" } },
        400,
      );
    }

    // MCP Streamable HTTP: the client only opens the server->client GET /mcp SSE
    // stream (how we push notifications/tools/list_changed for live tool reload)
    // if the server issued a session id on `initialize` — the SDK's
    // handle_get_stream() returns early when self.session_id is None. We're
    // single-tenant and authenticated by the bearer token, so we mint a session
    // id on initialize purely to unlock that stream, and accept any id elsewhere.
    if (messages.some((m) => (m as { method?: string })?.method === "initialize")) {
      c.header("Mcp-Session-Id", randomUUID());
    }

    const responses = [];
    for (const m of messages) {
      const method = (m as { method?: string })?.method;
      if (method === "tools/call") {
        const params = (m as { params?: { name?: string; arguments?: Record<string, unknown> } }).params;
        // Log the tool name + arg KEYS only — values may be user content / (later) write payloads.
        const argKeys =
          params?.arguments && typeof params.arguments === "object" ? Object.keys(params.arguments) : [];
        log.info({ tool: params?.name, argKeys }, "broker tools/call");
      }
      try {
        const res = await handleRpc(m as JsonRpcRequest, deps);
        if (res) responses.push(res);
      } catch (err) {
        const id = (m as { id?: string | number | null })?.id ?? null;
        log.error({ err, method: (m as { method?: string })?.method }, "broker rpc handler threw");
        responses.push({ jsonrpc: "2.0", id, error: { code: -32603, message: "Internal error" } });
      }
    }

    // Notifications only -> 202 Accepted, no body.
    if (responses.length === 0) return c.body(null, 202);
    return c.json(Array.isArray(body) ? responses : responses[0]);
  });

  // Optional MCP server->client SSE stream (Streamable HTTP). hermes'
  // streamablehttp_client opens this to receive server-initiated messages; we
  // push `notifications/tools/list_changed` over it when a grid/field changes so
  // the agent re-fetches tools/list live (no restart). See tool-change-bus.ts.
  app.get("/mcp", (c) => {
    if (!isAuthed(c)) {
      return c.json(
        { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
        401,
      );
    }
    // Disable proxy buffering so SSE frames reach the client immediately.
    c.header("Cache-Control", "no-cache, no-transform");
    c.header("X-Accel-Buffering", "no");
    return streamSSE(c, async (stream) => {
      const send = (payload: unknown) => {
        void stream.writeSSE({ data: JSON.stringify(payload) });
      };
      const remove = addToolStreamClient(send);
      stream.onAbort(remove);
      try {
        // Flush a comment IMMEDIATELY so the agent's streamablehttp_client
        // establishes the GET stream without hitting its read timeout while we
        // sit idle (a 20s initial silence exceeded httpx's read timeout and
        // dropped the stream → no live tools/list_changed). Then keep-alive at a
        // cadence well under any client/proxy idle timeout.
        await stream.write(": connected\n\n");
        while (!c.req.raw.signal.aborted) {
          await stream.sleep(10_000);
          await stream.write(": ping\n\n");
        }
      } finally {
        remove();
      }
    });
  });
  app.delete("/mcp", (c) => c.body(null, 204));

  return app;
}
