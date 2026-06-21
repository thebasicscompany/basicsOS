// Hono mount for the MCP Broker. hermes connects here over Streamable HTTP
// (POST /mcp). The instance is authenticated with a static bearer
// (BROKER_INSTANCE_TOKEN); per-user identity arrives per-call in tools/call
// params._meta (M4). Stateless: every method is request/response, so each POST
// is self-contained and we never open a server->client SSE stream.

import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import { logger } from "@/lib/logger.js";
import { resolveSingleOrgId } from "@/mcp-broker/data.js";
import {
  handleRpc,
  type BrokerDeps,
  type JsonRpcRequest,
  type ToolCallContext,
} from "@/mcp-broker/protocol.js";
import { buildTools } from "@/mcp-broker/tools.js";

const log = logger.child({ component: "mcp-broker" });

export function createBrokerRoutes(db: Db, env: Env) {
  const app = new Hono();
  const tools = buildTools(db, env);

  // One company per hermes instance — resolve the org id once, lazily, and cache.
  let orgIdPromise: Promise<string> | null = null;
  const getOrgId = () => (orgIdPromise ??= resolveSingleOrgId(db));

  const deps: BrokerDeps = {
    tools,
    resolveContext: async (meta): Promise<ToolCallContext> => {
      const orgId = await getOrgId();
      // M4 resolves (user, permissions) from the trusted session key in _meta.
      const sessionKey =
        (meta?.current_session_key as string | undefined) ??
        (meta?.["hermes/session_key"] as string | undefined) ??
        null;
      return { orgId, userId: null, sessionKey, meta: meta ?? null };
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

  // We don't offer the optional standalone GET SSE stream; stateless so no DELETE teardown.
  app.get("/mcp", (c) => c.text("Method Not Allowed", 405));
  app.delete("/mcp", (c) => c.body(null, 204));

  return app;
}
