// The M2 stub Broker tool surface: org-scoped object reads + memory recall.
// Tool names follow the contract (docs/CONTRACTS_MCP_BROKER_AND_APP_SDK.md A.3):
//   object.{slug}.{op}  and  memory.recall_context
// Later milestones add writes (object.*.create/update/delete, M4) and connections
// (connection.*, M5). The full generated-from-object_config manifest comes after F1.

import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { BrokerTool } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";
import {
  getContact,
  getDeal,
  recallContext,
  searchContacts,
  searchDeals,
} from "@/mcp-broker/data.js";

const searchSchema = {
  type: "object",
  properties: {
    query: { type: "string", description: "Free-text search (name, email, or company)." },
  },
  required: ["query"],
  additionalProperties: false,
} as const;

const getSchema = {
  type: "object",
  properties: {
    id: { type: "integer", description: "The record id." },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

function coerceId(args: Record<string, unknown>): number {
  const id = Number(args.id);
  if (!Number.isInteger(id) || id <= 0) throw new BrokerError("VALIDATION", "`id` must be a positive integer.");
  return id;
}

/** Clamp the requested chunk count to a sane bound (the schema advertises 1..20). */
function clampK(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5;
  return Math.min(20, Math.max(1, Math.trunc(n)));
}

export function buildTools(db: Db, env: Env): BrokerTool[] {
  return [
    {
      name: "object.contacts.search",
      description: "Search the company's contacts by name, email, or associated company. Returns matching contact records.",
      inputSchema: searchSchema as unknown as Record<string, unknown>,
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => ({ results: await searchContacts(db, ctx.orgId, String(args.query ?? "")) }),
    },
    {
      name: "object.contacts.get",
      description: "Get a single contact by id.",
      inputSchema: getSchema as unknown as Record<string, unknown>,
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => {
        const row = await getContact(db, ctx.orgId, coerceId(args));
        if (!row) throw new BrokerError("NOT_FOUND", `No contact with id ${args.id}.`);
        return row;
      },
    },
    {
      name: "object.deals.search",
      description: "Search the company's deals by deal name or the associated company name (e.g. \"Globex\" finds deals at Globex Industries). Returns matching deal records with status, amount, and company.",
      inputSchema: searchSchema as unknown as Record<string, unknown>,
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => ({ results: await searchDeals(db, ctx.orgId, String(args.query ?? "")) }),
    },
    {
      name: "object.deals.get",
      description: "Get a single deal by id.",
      inputSchema: getSchema as unknown as Record<string, unknown>,
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => {
        const row = await getDeal(db, ctx.orgId, coerceId(args));
        if (!row) throw new BrokerError("NOT_FOUND", `No deal with id ${args.id}.`);
        return row;
      },
    },
    {
      name: "memory.recall_context",
      description: "Retrieve relevant context from the company's knowledge (CRM records and notes) for a natural-language query, via semantic search. Returns the most relevant chunks.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to recall context about." },
          k: { type: "integer", description: "Max chunks to return (default 5).", minimum: 1, maximum: 20 },
        },
        required: ["query"],
        additionalProperties: false,
      } as unknown as Record<string, unknown>,
      meta: { source: "memory", writes: false },
      handle: async (args, ctx) =>
        recallContext(db, env, ctx.orgId, String(args.query ?? ""), clampK(args.k)),
    },
  ];
}
