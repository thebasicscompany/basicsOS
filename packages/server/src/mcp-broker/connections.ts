// connection.* tools — the agent's window into per-user app connections (Gmail,
// Slack, …). The Broker holds no Composio creds: it calls the central gateway's
// Composio endpoints with this company's Basics key + the acting user
// (X-User-Id from ctx.crmUserId). The gateway resolves the Composio entity
// (`${tenant}:${user}` personal, `${tenant}:org` fallback) and executes.
// See docs/CONTRACTS_MCP_BROKER_AND_APP_SDK.md A.4.3.

import type { Env } from "@/env.js";
import type { BrokerTool, ToolCallContext } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";

export async function callGateway(
  env: Env,
  ctx: ToolCallContext,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${env.BASICSOS_API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.SERVER_BASICS_API_KEY ?? ""}`,
      "X-User-Id": ctx.crmUserId != null ? String(ctx.crmUserId) : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json.error ?? {}) as { code?: string; message?: string; data?: unknown };
    // Surface NEEDS_CONNECTION (with authUrl) so the agent can prompt the user.
    if (err.code === "NEEDS_CONNECTION") {
      throw new BrokerError("NEEDS_CONNECTION", err.message ?? "Connect required.", err.data);
    }
    throw new BrokerError("UPSTREAM", err.message ?? `Connection service error (${res.status}).`);
  }
  return json;
}

const stringArg = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function buildConnectionTools(env: Env): BrokerTool[] {
  return [
    {
      name: "connection.catalog",
      description: "List the apps the user CAN connect (the available connection catalog, e.g. gmail, slack, notion, hubspot, github).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      meta: { source: "connection", writes: false },
      handle: async (_args, ctx) => callGateway(env, ctx, "GET", "/v1/composio/catalog"),
    },
    {
      name: "connection.list",
      description: "List the apps the current user (and the org) has already connected (e.g. gmail, slack).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      meta: { source: "connection", writes: false },
      handle: async (_args, ctx) => callGateway(env, ctx, "GET", "/v1/composio/connections"),
    },
    {
      name: "connection.connect",
      description:
        "Start connecting an external app (e.g. \"gmail\", \"slack\") for the current user. Returns an authUrl the user must open to authorize. Use when an action returns NEEDS_CONNECTION.",
      inputSchema: {
        type: "object",
        properties: { app: { type: "string", description: 'app slug, e.g. "gmail"' } },
        required: ["app"],
        additionalProperties: false,
      },
      meta: { source: "connection", writes: true },
      handle: async (args, ctx) => {
        const app = stringArg(args.app);
        if (!app) throw new BrokerError("VALIDATION", "`app` is required.");
        return callGateway(env, ctx, "POST", "/v1/composio/connect", { app });
      },
    },
    {
      name: "connection.list_actions",
      description:
        'List an app\'s actions WITH each action\'s required + accepted argument names (e.g. app="gmail" -> GMAIL_SEND_EMAIL {required: recipient_email, body; props: subject, cc, ...}). Call this BEFORE connection.execute so you pass the exact field names.',
      inputSchema: {
        type: "object",
        properties: { app: { type: "string" } },
        required: ["app"],
        additionalProperties: false,
      },
      meta: { source: "connection", writes: false },
      handle: async (args, ctx) => {
        const app = stringArg(args.app);
        if (!app) throw new BrokerError("VALIDATION", "`app` is required.");
        return callGateway(env, ctx, "GET", `/v1/composio/actions?app=${encodeURIComponent(app)}`);
      },
    },
    {
      name: "connection.execute",
      description:
        'Run an action on a connected app as the current user. Use the EXACT argument names from connection.list_actions — e.g. app="gmail", action="GMAIL_SEND_EMAIL", arguments={recipient_email, subject, body} (NOT "to"). Returns NEEDS_CONNECTION {authUrl} if not connected.',
      inputSchema: {
        type: "object",
        properties: {
          app: { type: "string" },
          action: { type: "string", description: "action slug, e.g. GMAIL_SEND_EMAIL" },
          arguments: { type: "object", description: "action parameters" },
        },
        required: ["app", "action"],
        additionalProperties: false,
      },
      meta: { source: "connection", writes: true },
      handle: async (args, ctx) => {
        const app = stringArg(args.app);
        const action = stringArg(args.action);
        if (!app || !action) throw new BrokerError("VALIDATION", "`app` and `action` are required.");
        const arguments_ = (args.arguments && typeof args.arguments === "object" ? args.arguments : {}) as Record<string, unknown>;
        return callGateway(env, ctx, "POST", "/v1/composio/execute", { app, action, arguments: arguments_ });
      },
    },
  ];
}
