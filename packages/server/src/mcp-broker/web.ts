// web.search — public web research for the agent (and automations). Backed by
// the gateway's Exa execute route (a PLATFORM key, not a per-user connection),
// so it works for every user with no OAuth/NEEDS_CONNECTION step. Reuses the
// same gateway-call helper as connection.* (Basics key + X-User-Id).

import type { Env } from "@/env.js";
import type { BrokerTool } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";
import { callGateway } from "@/mcp-broker/connections.js";

export function buildWebTools(env: Env): BrokerTool[] {
  return [
    {
      name: "web.search",
      description:
        "Search the public web for up-to-date information (company news, research, facts). Returns titles, URLs, and text snippets. Use for anything beyond the company's own CRM/memory.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "the search query" },
          numResults: { type: "integer", description: "1-20, default 5" },
        },
        required: ["query"],
        additionalProperties: false,
      },
      meta: { source: "system", writes: false },
      handle: async (args, ctx) => {
        const query = String(args.query ?? "").trim();
        if (!query) throw new BrokerError("VALIDATION", "`query` is required.");
        const n = Number(args.numResults);
        const numResults = Number.isFinite(n) ? Math.min(20, Math.max(1, Math.trunc(n))) : 5;
        return callGateway(env, ctx, "POST", "/v1/execute/web/search", { query, numResults });
      },
    },
  ];
}
