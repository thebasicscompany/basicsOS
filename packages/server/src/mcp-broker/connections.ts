// connection.* tools — the agent's window into per-user app connections (Gmail,
// Slack, …). The Broker holds no Composio creds: it calls the central gateway's
// Composio endpoints with this company's Basics key + the acting user
// (X-User-Id from ctx.crmUserId). The gateway resolves the Composio entity
// (`${tenant}:${user}` personal, `${tenant}:org` fallback) and executes.
// See docs/CONTRACTS_MCP_BROKER_AND_APP_SDK.md A.4.3.

import type { Env } from "@/env.js";
import type { BrokerTool, ToolCallContext } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";
import { recordNeedsConnection } from "@/lib/pending-connections.js";

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
    // Surface NEEDS_CONNECTION (with authUrl) so the agent can prompt the user,
    // AND record it so the chat endpoint renders a Connect card for this app
    // deterministically (handles multiple missing apps; no reliance on the model).
    if (err.code === "NEEDS_CONNECTION") {
      const d = (err.data ?? {}) as { app?: string; authUrl?: string };
      if (d.app && d.authUrl) recordNeedsConnection(ctx.sessionKey, d.app, d.authUrl);
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
      description:
        "Informational only — the apps the current user/org has already connected. Do NOT use this to refuse a task: if a needed app is missing, call connection.connect for it (or just attempt connection.execute).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      meta: { source: "connection", writes: false },
      handle: async (_args, ctx) => callGateway(env, ctx, "GET", "/v1/composio/connections"),
    },
    {
      name: "connection.connect",
      description:
        'Set up an external app (e.g. "gmail", "slack") for the current user when it is not connected yet. Call this whenever a task needs an app the user hasn\'t connected. A Connect button is shown to the user automatically — just tell them you need access to the app; do NOT paste any URL yourself.',
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
        const res = await callGateway(env, ctx, "POST", "/v1/composio/connect", { app });
        // Drive the deterministic Connect card from connect() too (not just the
        // NEEDS_CONNECTION path), since the agent often connects pre-emptively.
        if (typeof res.authUrl === "string") recordNeedsConnection(ctx.sessionKey, app, res.authUrl);
        return res;
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
        'Run an action on a connected app as the current user. When a task needs an app, just call this directly (no need to pre-check). Use the EXACT argument names from connection.list_actions — e.g. app="gmail", action="GMAIL_SEND_EMAIL", arguments={recipient_email, subject, body} (NOT "to"). If it returns NEEDS_CONNECTION, briefly tell the user which app you need access to — a Connect button is shown to them automatically, so do NOT paste any URL yourself.',
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
