// The M2 stub Broker tool surface: org-scoped object reads + memory recall.
// Tool names follow the contract (docs/CONTRACTS_MCP_BROKER_AND_APP_SDK.md A.3):
//   object.{slug}.{op}  and  memory.recall_context
// Later milestones add writes (object.*.create/update/delete, M4) and connections
// (connection.*, M5). The full generated-from-object_config manifest comes after F1.

import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { BrokerTool } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";
import { PERMISSIONS } from "@/lib/rbac.js";
import {
  createRecord,
  deleteRecordById,
  getContact,
  getDeal,
  recallContext,
  searchContacts,
  searchDeals,
  updateRecordById,
  type WritableResource,
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

// ── Write tools (M4) ─────────────────────────────────────────────────────────
// Hand-coded CRUD for the three core objects; the full object_config-generated
// manifest for every object is task #8. Writes are RBAC-gated (BrokerTool.requires)
// and stamp the acting crm user (ctx.crmUserId, from the trusted _meta session key).

interface WriteFieldSpec {
  props: Record<string, { type: string; description?: string }>;
  required: string[];
}

const WRITE_SPECS: Record<WritableResource, { singular: string } & WriteFieldSpec> = {
  contacts: {
    singular: "contact",
    props: {
      firstName: { type: "string" },
      lastName: { type: "string" },
      email: { type: "string" },
      companyId: { type: "integer", description: "associated company id" },
      linkedinUrl: { type: "string" },
    },
    required: [],
  },
  companies: {
    singular: "company",
    props: {
      name: { type: "string" },
      domain: { type: "string" },
      category: { type: "string" },
      description: { type: "string" },
    },
    required: ["name"],
  },
  deals: {
    singular: "deal",
    props: {
      name: { type: "string" },
      status: {
        type: "string",
        description: "pipeline stage, e.g. opportunity, proposal-made, in-negotiation, won, lost",
      },
      amount: { type: "number" },
      companyId: { type: "integer", description: "associated company id" },
    },
    required: ["name"],
  },
};

const NUMERIC_FIELDS = new Set(["companyId", "amount"]);

/** Pick only the spec's known fields from args and coerce numeric ones. */
function buildBody(spec: WriteFieldSpec, args: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(spec.props)) {
    if (args[key] === undefined || args[key] === null) continue;
    if (NUMERIC_FIELDS.has(key)) {
      const n = Number(args[key]);
      if (!Number.isFinite(n)) throw new BrokerError("VALIDATION", `\`${key}\` must be a number.`);
      body[key] = n;
    } else {
      body[key] = args[key];
    }
  }
  return body;
}

function objSchema(props: Record<string, unknown>, required: string[]) {
  return { type: "object", properties: props, required, additionalProperties: false } as unknown as Record<string, unknown>;
}

function buildWriteTools(db: Db): BrokerTool[] {
  const tools: BrokerTool[] = [];
  for (const resource of Object.keys(WRITE_SPECS) as WritableResource[]) {
    const spec = WRITE_SPECS[resource];
    const withId = { id: { type: "integer", description: `the ${spec.singular} id` }, ...spec.props };

    tools.push({
      name: `object.${resource}.create`,
      description: `Create a new ${spec.singular}.`,
      inputSchema: objSchema(spec.props, spec.required),
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.recordsWrite,
      handle: async (args, ctx) => {
        const row = await createRecord(db, ctx.orgId, ctx.crmUserId as number, resource, buildBody(spec, args));
        return { created: row };
      },
    });

    tools.push({
      name: `object.${resource}.update`,
      description: `Update an existing ${spec.singular} by id.`,
      inputSchema: objSchema(withId, ["id"]),
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.recordsWrite,
      handle: async (args, ctx) => {
        const id = coerceId(args);
        const body = buildBody(spec, args);
        if (Object.keys(body).length === 0) throw new BrokerError("VALIDATION", "No fields to update.");
        const row = await updateRecordById(db, ctx.orgId, resource, id, body);
        if (!row) throw new BrokerError("NOT_FOUND", `No ${spec.singular} with id ${id}.`);
        return { updated: row };
      },
    });

    tools.push({
      name: `object.${resource}.delete`,
      description: `Permanently delete a ${spec.singular} by id.`,
      inputSchema: objSchema({ id: { type: "integer", description: `the ${spec.singular} id` } }, ["id"]),
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.recordsDeleteHard,
      handle: async (args, ctx) => {
        const id = coerceId(args);
        const row = await deleteRecordById(db, ctx.orgId, resource, id);
        if (!row) throw new BrokerError("NOT_FOUND", `No ${spec.singular} with id ${id}.`);
        return { deleted: { id } };
      },
    });
  }
  return tools;
}

export function buildTools(db: Db, env: Env): BrokerTool[] {
  return [
    ...buildWriteTools(db),
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
