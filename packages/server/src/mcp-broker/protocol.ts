// Minimal MCP (Model Context Protocol) server core for the BasicsOS Tool Broker.
//
// hermes connects to this over the **Streamable HTTP** transport (the default
// for an `mcp_servers.<name>.url`): each JSON-RPC message is an HTTP POST and we
// reply with a single `application/json` JSON-RPC response (no SSE, no session —
// every method we expose is request/response, so a stateless server is correct
// and the official MCP client handles it). We implement only the surface hermes
// exercises: initialize, notifications/initialized, tools/list, tools/call, ping.
//
// Identity: hermes authenticates the *instance* with a static bearer
// (BROKER_INSTANCE_TOKEN). The per-user (tenant,user) identity is carried
// per-call in `tools/call` `params._meta` (M4) — never as a model-visible tool
// argument. See docs/CONTRACTS_MCP_BROKER_AND_APP_SDK.md A.2/A.5.

export const BROKER_NAME = "basicsos-broker";
export const BROKER_VERSION = "0.1.0";
// Protocol versions we understand; we echo the client's if we support it.
const SUPPORTED_PROTOCOL = "2025-06-18";
const FALLBACK_PROTOCOL = "2024-11-05";

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// Stable broker error codes surfaced to the agent (contract A.5).
export type BrokerErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "UPSTREAM"
  | "CONFLICT"
  | "NEEDS_CONNECTION";

export class BrokerError extends Error {
  code: BrokerErrorCode;
  data?: unknown;
  constructor(code: BrokerErrorCode, message: string, data?: unknown) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

/** An MCP tool the broker advertises + how to run it. */
export interface BrokerTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  /** internal routing/enforcement metadata — never sent to the model */
  meta: { source: "native" | "memory" | "connection" | "app" | "system"; writes: boolean };
  /** RBAC permission required to call this tool (writes); undefined = open (reads) */
  requires?: string;
  handle: (args: Record<string, unknown>, ctx: ToolCallContext) => Promise<unknown>;
}

/** Resolved per-call context handed to a tool handler. */
export interface ToolCallContext {
  /** the company/org this hermes instance serves */
  orgId: string;
  /** acting crm user id (from the trusted _meta session key); null = org-scoped */
  crmUserId: number | null;
  /** trusted session key from _meta.current_session_key (M4) */
  sessionKey: string | null;
  /** the acting user's RBAC permission set ("*" = admin) */
  permissions: Set<string>;
  /** convenience predicate: permissions.has("*") || permissions.has(p) */
  can: (permission: string) => boolean;
  /** raw _meta passthrough for future use */
  meta: Record<string, unknown> | null;
}

export interface BrokerDeps {
  tools: BrokerTool[];
  /** resolve the acting context from a tools/call params._meta block */
  resolveContext: (meta: Record<string, unknown> | null) => Promise<ToolCallContext>;
  /** server-side error sink; raw errors are never returned to the caller/model */
  logError?: (err: unknown, context: string) => void;
}

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

function toolToWire(t: BrokerTool) {
  return { name: t.name, description: t.description, inputSchema: t.inputSchema };
}

/**
 * Handle a single JSON-RPC message. Returns a response object for requests, or
 * `null` for notifications (the caller answers 202 with no body).
 */
export async function handleRpc(
  msg: JsonRpcRequest,
  deps: BrokerDeps,
): Promise<JsonRpcResponse | null> {
  const isNotification = msg.id === undefined || msg.id === null;
  const id = (msg.id ?? null) as JsonRpcId;
  const method = msg.method;

  // Notifications (no reply): initialized, cancelled, progress, etc.
  if (isNotification) return null;

  switch (method) {
    case "initialize": {
      const requested = (msg.params?.protocolVersion as string) || "";
      const protocolVersion =
        requested === SUPPORTED_PROTOCOL || requested === FALLBACK_PROTOCOL
          ? requested
          : SUPPORTED_PROTOCOL;
      return ok(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: BROKER_NAME, version: BROKER_VERSION },
      });
    }

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, { tools: deps.tools.map(toolToWire) });

    case "tools/call": {
      const name = msg.params?.name as string;
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      const meta = (msg.params?._meta as Record<string, unknown>) ?? null;
      const tool = deps.tools.find((t) => t.name === name);
      if (!tool) {
        return ok(id, callError("NOT_FOUND", `Unknown tool: ${name}`));
      }
      try {
        const ctx = await deps.resolveContext(meta);
        // RBAC gate. Any write tool needs a known acting user (fail closed even if
        // a tool forgets to declare `requires`); `requires` additionally checks the
        // specific permission.
        if (tool.meta.writes && ctx.crmUserId == null) {
          return ok(id, callError("FORBIDDEN", "This action requires an authenticated user; no identity was provided."));
        }
        if (tool.requires && !ctx.can(tool.requires)) {
          return ok(id, callError("FORBIDDEN", `You don't have permission to perform this action (requires ${tool.requires}).`));
        }
        const result = await tool.handle(args, ctx);
        return ok(id, {
          content: [{ type: "text", text: jsonText(result) }],
          isError: false,
        });
      } catch (err) {
        if (err instanceof BrokerError) {
          return ok(id, callError(err.code, err.message, err.data));
        }
        // Never leak raw driver/internal errors (SQL, column names, stacks) to
        // the model/caller — log server-side, return a generic message.
        deps.logError?.(err, `tools/call ${name}`);
        return ok(id, callError("UPSTREAM", "Internal error executing tool."));
      }
    }

    default:
      // -32601 Method not found
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

/** A tool-level error result (model-visible, with a stable code). */
function callError(code: BrokerErrorCode, message: string, data?: unknown) {
  return {
    content: [{ type: "text", text: jsonText({ error: { code, message, ...(data ? { data } : {}) } }) }],
    isError: true,
  };
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export const PROTOCOL = { SUPPORTED_PROTOCOL, FALLBACK_PROTOCOL };
