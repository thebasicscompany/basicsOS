// Hono mount for the MCP Broker. hermes connects here over Streamable HTTP
// (POST /mcp). The instance is authenticated with a static bearer
// (BROKER_INSTANCE_TOKEN); per-user identity arrives per-call in tools/call
// params._meta (M4). POST is request/response; we ALSO expose the optional
// server->client SSE stream (GET /mcp) to push notifications/tools/list_changed
// when the tool surface changes (auto-reload — see tool-change-bus.ts).

import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import { logger } from "@/lib/logger.js";
import * as schema from "@/db/schema/index.js";
import { getPermissionSetForUser, hasPermission } from "@/lib/rbac.js";
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

export function createBrokerRoutes(db: Db, env: Env) {
  const app = new Hono();
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
    const tools = [...staticTools, ...custom];
    toolsCache = { at: now, tools };
    return tools;
  };
  // A tool-surface change (grid/field add/remove) drops the cache so the next
  // tools/list is freshly generated for this org.
  setToolCacheInvalidator(() => {
    toolsCache = null;
  });

  const deps: BrokerDeps = {
    getTools,
    resolveContext: async (meta): Promise<ToolCallContext> => {
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

      return {
        orgId,
        crmUserId,
        sessionKey,
        permissions,
        can: (p: string) => hasPermission(permissions, p),
        meta: meta ?? null,
      };
    },
    logError: (err, context) => log.error({ err }, context),
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
    return streamSSE(c, async (stream) => {
      const send = (payload: unknown) => {
        void stream.writeSSE({ data: JSON.stringify(payload) });
      };
      const remove = addToolStreamClient(send);
      stream.onAbort(remove);
      try {
        // Hold the stream open; a periodic SSE comment keeps idle proxies from
        // closing it (clients ignore `:`-prefixed lines).
        while (!c.req.raw.signal.aborted) {
          await stream.sleep(20_000);
          await stream.write(":\n\n");
        }
      } finally {
        remove();
      }
    });
  });
  app.delete("/mcp", (c) => c.body(null, 204));

  return app;
}
