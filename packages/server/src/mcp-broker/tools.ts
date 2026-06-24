// The Broker tool surface. Reaches parity with (and exceeds) the legacy chat:
//   object.{contacts,companies,deals,tasks,contact_notes,deal_notes,company_notes}
//     .{search,get,create,update,delete}   (generic data-access; org-scoped)
//   object.tasks.complete
//   meetings.list / meetings.get_transcript / meetings.get_summary  (read — beyond legacy)
//   custom_field.create / custom_field.delete
//   memory.recall_context
// contacts/deals keep a company-aware search; everything else uses generic search.
// Writes are RBAC-gated (BrokerTool.requires) and stamp the acting user (ctx.crmUserId).
// The full object_config attribute-driven generator for CUSTOM objects is the
// remaining follow-up (none exist yet; needs custom_fields-jsonb routing).

import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { BrokerTool } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";
import { PERMISSIONS } from "@/lib/rbac.js";
import { buildConnectionTools } from "@/mcp-broker/connections.js";
import { buildContextTools } from "@/mcp-broker/context-tools.js";
import { buildAutomationTools } from "@/mcp-broker/automations.js";
import { buildWebTools } from "@/mcp-broker/web.js";
import { buildAITools } from "@/mcp-broker/ai.js";
import { buildConnectorTools } from "@/mcp-broker/connectors-tools.js";
import { buildEmailTools } from "@/mcp-broker/email.js";
import { buildFileTools } from "@/mcp-broker/files.js";
import {
  createCustomField,
  createRecord,
  deleteCustomField,
  deleteRecordById,
  getContact,
  getDeal,
  getMeetingSummary,
  getMeetingTranscript,
  getResource,
  listCustomFieldDefs,
  listCustomObjects,
  listMeetings,
  recallContext,
  searchContacts,
  searchCustomRecords,
  searchDeals,
  searchResource,
  setTaskDone,
  updateRecordById,
  type WritableResource,
} from "@/mcp-broker/data.js";
import {
  deleteCustomRecord,
  getCustomRecord,
  insertCustomRecord,
  updateCustomRecord,
} from "@/data-access/crm/dynamic-table.js";

function coerceId(args: Record<string, unknown>): number {
  const id = Number(args.id);
  if (!Number.isInteger(id) || id <= 0) throw new BrokerError("VALIDATION", "`id` must be a positive integer.");
  return id;
}

function clampK(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5;
  return Math.min(20, Math.max(1, Math.trunc(n)));
}

function objSchema(props: Record<string, unknown>, required: string[]): Record<string, unknown> {
  return { type: "object", properties: props, required, additionalProperties: false };
}

// ── Per-resource writable field specs ────────────────────────────────────────
interface WriteSpec {
  singular: string;
  props: Record<string, { type: string; description?: string }>;
  required: string[];
  /** extra disambiguation appended to create/update descriptions */
  hint?: string;
}

const WRITE_SPECS: Record<WritableResource, WriteSpec> = {
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
    hint: "A deal is a SALES OPPORTUNITY in the pipeline (has a monetary value/stage). Do NOT use this for a to-do or reminder — use object.tasks.create for that.",
    props: {
      name: { type: "string" },
      status: { type: "string", description: "pipeline stage, e.g. opportunity, proposal-made, in-negotiation, won, lost" },
      amount: { type: "number" },
      companyId: { type: "integer", description: "associated company id" },
    },
    required: ["name"],
  },
  tasks: {
    singular: "task",
    hint: "A task is a TO-DO / action item / reminder (e.g. 'follow up with X'). Do NOT use this to create a sales deal — use object.deals.create for that.",
    props: {
      text: { type: "string", description: "what to do" },
      description: { type: "string" },
      type: { type: "string", description: "e.g. call, email, meeting" },
      dueDate: { type: "string", description: "ISO date-time" },
      contactId: { type: "integer" },
      companyId: { type: "integer" },
      dealId: { type: "integer" },
      assigneeId: { type: "integer", description: "crm user id to assign to" },
    },
    required: ["text"],
  },
  contact_notes: {
    singular: "contact note",
    props: {
      contactId: { type: "integer" },
      title: { type: "string" },
      text: { type: "string" },
      status: { type: "string" },
    },
    required: ["contactId"],
  },
  deal_notes: {
    singular: "deal note",
    props: {
      dealId: { type: "integer" },
      title: { type: "string" },
      text: { type: "string" },
      status: { type: "string" },
    },
    required: ["dealId"],
  },
  company_notes: {
    singular: "company note",
    props: {
      companyId: { type: "integer" },
      title: { type: "string" },
      text: { type: "string" },
      status: { type: "string" },
    },
    required: ["companyId"],
  },
};

const NUMERIC_FIELDS = new Set(["companyId", "amount", "contactId", "dealId", "assigneeId"]);
const DATE_FIELDS = new Set(["dueDate"]);
/** contacts/deals get a richer company-aware search; the rest use generic search. */
const CUSTOM_SEARCH = new Set<WritableResource>(["contacts", "deals"]);

/** Pick the spec's known fields from args, coercing numeric/date fields. */
function buildBody(spec: WriteSpec, args: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(spec.props)) {
    const v = args[key];
    if (v === undefined || v === null) continue;
    if (NUMERIC_FIELDS.has(key)) {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new BrokerError("VALIDATION", `\`${key}\` must be a number.`);
      body[key] = n;
    } else if (DATE_FIELDS.has(key)) {
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) throw new BrokerError("VALIDATION", `\`${key}\` must be a valid date.`);
      body[key] = d;
    } else {
      body[key] = v;
    }
  }
  return body;
}

function requireFields(spec: WriteSpec, body: Record<string, unknown>) {
  for (const f of spec.required) {
    if (body[f] === undefined) throw new BrokerError("VALIDATION", `\`${f}\` is required.`);
  }
}

const searchSchema = objSchema(
  {
    query: {
      type: "string",
      description:
        "Text to filter records by — matches their CONTENT (name + field values). OMIT or pass \"\" to list ALL records: do that for 'do I have any X', 'list my X', 'show X'. Do NOT pass the object's own name (e.g. 'vendors') as the query — that filters for records literally containing that word and usually returns nothing.",
    },
  },
  [],
);
const getSchema = objSchema({ id: { type: "integer" } }, ["id"]);

/** Generated CRUD for every standard resource (search/get/create/update/delete). */
function buildResourceTools(db: Db): BrokerTool[] {
  const tools: BrokerTool[] = [];
  for (const resource of Object.keys(WRITE_SPECS) as WritableResource[]) {
    const spec = WRITE_SPECS[resource];

    if (!CUSTOM_SEARCH.has(resource)) {
      tools.push({
        name: `object.${resource}.search`,
        description: `Search ${spec.singular}s by free text.`,
        inputSchema: searchSchema,
        meta: { source: "native", writes: false },
        handle: async (args, ctx) => ({ results: await searchResource(db, ctx.orgId, resource, String(args.query ?? "")) }),
      });
      tools.push({
        name: `object.${resource}.get`,
        description: `Get a single ${spec.singular} by id.`,
        inputSchema: getSchema,
        meta: { source: "native", writes: false },
        handle: async (args, ctx) => {
          const row = await getResource(db, ctx.orgId, resource, coerceId(args));
          if (!row) throw new BrokerError("NOT_FOUND", `No ${spec.singular} with id ${args.id}.`);
          return row;
        },
      });
    }

    tools.push({
      name: `object.${resource}.create`,
      description: `Create a new ${spec.singular}.${spec.hint ? " " + spec.hint : ""}`,
      inputSchema: objSchema(spec.props, spec.required),
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.recordsWrite,
      handle: async (args, ctx) => {
        const body = buildBody(spec, args);
        requireFields(spec, body);
        return { created: await createRecord(db, ctx.orgId, ctx.crmUserId as number, resource, body) };
      },
    });

    tools.push({
      name: `object.${resource}.create_many`,
      description: `Create MULTIPLE ${spec.singular}s in one call. Pass { records: [...] } where each item is a ${spec.singular}. Returns created rows + per-row errors (partial success).`,
      inputSchema: objSchema(
        {
          records: {
            type: "array",
            description: `array of ${spec.singular}s to create`,
            items: objSchema(spec.props, spec.required),
          },
        },
        ["records"],
      ),
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.recordsWrite,
      handle: async (args, ctx) => {
        const records = Array.isArray(args.records) ? (args.records as Record<string, unknown>[]) : [];
        if (records.length === 0) throw new BrokerError("VALIDATION", "`records` must be a non-empty array.");
        if (records.length > 1000) throw new BrokerError("VALIDATION", "Too many records (max 1000).");
        const created: unknown[] = [];
        const errors: { index: number; error: string }[] = [];
        for (let i = 0; i < records.length; i++) {
          try {
            const body = buildBody(spec, records[i] ?? {});
            requireFields(spec, body);
            created.push(await createRecord(db, ctx.orgId, ctx.crmUserId as number, resource, body));
          } catch (e) {
            errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return { created, errors };
      },
    });

    tools.push({
      name: `object.${resource}.update`,
      description: `Update an existing ${spec.singular} by id.`,
      inputSchema: objSchema({ id: { type: "integer" }, ...spec.props }, ["id"]),
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
      inputSchema: getSchema,
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

/** Bespoke tools: company-aware searches, memory, task-complete, meetings, custom fields. */
function buildBespokeTools(db: Db, env: Env): BrokerTool[] {
  return [
    {
      name: "object.contacts.search",
      description: "Search contacts by name, email, or associated company.",
      inputSchema: searchSchema,
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => ({ results: await searchContacts(db, ctx.orgId, String(args.query ?? "")) }),
    },
    {
      name: "object.contacts.get",
      description: "Get a single contact by id (with company).",
      inputSchema: getSchema,
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => {
        const row = await getContact(db, ctx.orgId, coerceId(args));
        if (!row) throw new BrokerError("NOT_FOUND", `No contact with id ${args.id}.`);
        return row;
      },
    },
    {
      name: "object.deals.search",
      description:
        'Search deals by deal name or associated company name (e.g. "Globex" finds deals at Globex Industries). Optional `status` filters by pipeline stage (opportunity, proposal-made, in-negotiation, won, lost). Omit `query` to list all deals.',
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "free-text; omit/empty to list all" },
          status: { type: "string", description: "pipeline stage filter, e.g. opportunity" },
        },
        additionalProperties: false,
      },
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => ({
        results: await searchDeals(db, ctx.orgId, String(args.query ?? ""), args.status ? String(args.status) : undefined),
      }),
    },
    {
      name: "object.deals.get",
      description: "Get a single deal by id (with company).",
      inputSchema: getSchema,
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => {
        const row = await getDeal(db, ctx.orgId, coerceId(args));
        if (!row) throw new BrokerError("NOT_FOUND", `No deal with id ${args.id}.`);
        return row;
      },
    },
    {
      name: "object.tasks.complete",
      description: "Mark a task complete (or set done=false to reopen).",
      inputSchema: objSchema({ id: { type: "integer" }, done: { type: "boolean", description: "default true" } }, ["id"]),
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.recordsWrite,
      handle: async (args, ctx) => {
        const id = coerceId(args);
        const done = args.done === undefined ? true : Boolean(args.done);
        const row = await setTaskDone(db, ctx.orgId, id, done);
        if (!row) throw new BrokerError("NOT_FOUND", `No task with id ${id}.`);
        return { updated: row };
      },
    },
    {
      name: "meetings.list",
      description: "List recent meetings (id, title, date, status).",
      inputSchema: objSchema({ limit: { type: "integer", description: "max 50, default 20" } }, []),
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => {
        const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
        return { meetings: await listMeetings(db, ctx.orgId, limit) };
      },
    },
    {
      name: "meetings.get_transcript",
      description: "Get a meeting's transcript (ordered speaker turns) by meeting id.",
      inputSchema: objSchema({ id: { type: "integer", description: "meeting id" } }, ["id"]),
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => ({ transcript: await getMeetingTranscript(db, ctx.orgId, coerceId(args)) }),
    },
    {
      name: "meetings.get_summary",
      description: "Get a meeting's summary (decisions, action items, follow-ups) by meeting id.",
      inputSchema: objSchema({ id: { type: "integer", description: "meeting id" } }, ["id"]),
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => ({ summary: await getMeetingSummary(db, ctx.orgId, coerceId(args)) }),
    },
    {
      name: "custom_field.create",
      description: "Add a custom field to an object (contacts/companies/deals or a custom object).",
      inputSchema: objSchema(
        {
          resource: { type: "string", description: "object slug, e.g. contacts" },
          name: { type: "string", description: "snake_case key" },
          label: { type: "string", description: "human label" },
          fieldType: { type: "string", description: "text|long-text|number|currency|select|multi-select|status|checkbox|date|timestamp|rating|email|phone|url|location" },
          options: { type: "array", description: "for select/multi-select/status", items: { type: "string" } },
        },
        ["resource", "name", "label", "fieldType"],
      ),
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.objectConfigWrite,
      handle: async (args, ctx) => ({
        created: await createCustomField(
          db,
          ctx.orgId,
          String(args.resource),
          String(args.name),
          String(args.label),
          String(args.fieldType),
          Array.isArray(args.options) ? args.options : undefined,
        ),
      }),
    },
    {
      name: "custom_field.delete",
      description: "Delete a custom field definition by id.",
      inputSchema: getSchema,
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.objectConfigWrite,
      handle: async (args, ctx) => {
        const row = await deleteCustomField(db, ctx.orgId, coerceId(args));
        if (!row) throw new BrokerError("NOT_FOUND", `No custom field with id ${args.id}.`);
        return { deleted: { id: coerceId(args) } };
      },
    },
    {
      name: "memory.recall_context",
      description: "Retrieve relevant context from the company's knowledge (CRM records + notes) via semantic search.",
      inputSchema: objSchema(
        {
          query: { type: "string", description: "what to recall context about" },
          k: { type: "integer", description: "max chunks (1-20, default 5)" },
        },
        ["query"],
      ),
      meta: { source: "memory", writes: false },
      handle: async (args, ctx) => recallContext(db, env, ctx.orgId, String(args.query ?? ""), clampK(args.k)),
    },
  ];
}

/** Map a `custom_field_defs.fieldType` to JSON Schema (contract A.3.2). */
function fieldTypeToSchema(fieldType: string, options: unknown): Record<string, unknown> {
  const enumVals = Array.isArray(options)
    ? (options as unknown[])
        .map((o) =>
          typeof o === "string"
            ? o
            : ((o as { id?: string; value?: string })?.id ?? (o as { value?: string })?.value),
        )
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  switch (fieldType) {
    case "number":
    case "currency":
    case "rating":
      return { type: "number" };
    case "checkbox":
      return { type: "boolean" };
    case "date":
      return { type: "string", description: "ISO date (YYYY-MM-DD)" };
    case "timestamp":
      return { type: "string", description: "ISO date-time" };
    case "select":
    case "status":
      return enumVals.length ? { type: "string", enum: enumVals } : { type: "string" };
    case "multi-select":
      return { type: "array", items: enumVals.length ? { type: "string", enum: enumVals } : { type: "string" } };
    default:
      return { type: "string" }; // text | long-text | email | phone | url | location
  }
}

/**
 * Generated CRUD for this org's CUSTOM objects (each its own `custom_<slug>`
 * table), built from `object_config` + `custom_field_defs`. A grid created in
 * the UI / by CSV import becomes agent-usable as `object.{slug}.*` with no code
 * change (contract A.3 / A.4.1). Records are { name, ...fields }; the data layer
 * folds non-`name` fields into the `custom_fields` jsonb column.
 */
/** Coerce a generic-tool `fields`/record arg into a plain field map (drops
 * non-objects, arrays, and a `customFields` wrapper handled downstream). */
function pickFields(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** Resolve the field map for a generic write: an explicit `fields` object if given,
 * else the remaining top-level args treated as flat fields — so BOTH the agent
 * ({object,fields}) and a declarative form ({object, message, rating}) work. */
function flexFields(args: Record<string, unknown>): Record<string, unknown> {
  if (args.fields && typeof args.fields === "object" && !Array.isArray(args.fields)) {
    return args.fields as Record<string, unknown>;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (k === "object" || k === "id" || k === "fields" || k === "records") continue;
    out[k] = v;
  }
  return out;
}

export async function buildCustomObjectTools(db: Db, orgId: string): Promise<BrokerTool[]> {
  const objects = await listCustomObjects(db, orgId);
  const tools: BrokerTool[] = [];

  // Generic, slug-parameterized object tools. Each object below also gets its own
  // object.{slug}.* tools (convenient + what the agent prefers), but those grow 6
  // per object and providers cap the tool list (OpenAI: 128). These two give the
  // agent a FIXED-COST way to discover + search ANY object/grid by slug, so large
  // orgs stay usable even past the per-object cap.
  const standardSlugs = Object.keys(WRITE_SPECS) as WritableResource[];
  const customBySlug = new Map(objects.map((o) => [o.slug, o]));
  const allSlugs = [...standardSlugs, ...objects.map((o) => o.slug)];
  tools.push(
    {
      name: "object.list",
      description: `List every object/grid in this CRM (built-in + custom) with its slug, for use with object.search/object.get. Available: ${allSlugs.join(", ")}.`,
      inputSchema: objSchema({}, []),
      meta: { source: "native", writes: false },
      handle: async () => ({
        objects: [
          ...standardSlugs.map((s) => ({ slug: s, kind: "builtin", singular: WRITE_SPECS[s].singular })),
          ...objects.map((o) => ({ slug: o.slug, kind: "custom", singular: o.singular, plural: o.plural })),
        ],
      }),
    },
    {
      name: "object.search",
      description: `List/search ANY object/grid by slug (built-in OR custom) — a generic alternative to object.{slug}.search. Pass { object: "<slug>" } with NO query (or query:"") to list ALL records of that object — use this for "do I have any X?". Add query only to filter by text in record name/fields (never pass the object name as query). Use object.list for slugs.`,
      inputSchema: objSchema(
        {
          object: { type: "string", description: `object slug, e.g. ${allSlugs.slice(0, 6).join(", ")}` },
          query: { type: "string", description: "OPTIONAL text filter over record content; omit/\"\" = list all" },
        },
        ["object"],
      ),
      meta: { source: "native", writes: false },
      handle: async (args, ctx) => {
        const slug = String(args.object ?? "").trim();
        const query = String(args.query ?? "");
        const custom = customBySlug.get(slug);
        if (custom) {
          return { results: await searchCustomRecords(db, ctx.orgId, custom.tableName, query) };
        }
        if ((standardSlugs as string[]).includes(slug)) {
          return { results: await searchResource(db, ctx.orgId, slug as WritableResource, query) };
        }
        throw new BrokerError("NOT_FOUND", `Unknown object '${slug}'. Call object.list to see available objects.`);
      },
    },
    {
      name: "object.create",
      description: `Create ONE record in ANY object/grid by slug (built-in OR custom). A generic alternative to object.{slug}.create that ALWAYS works — even for an object that was JUST created (per-object tools can lag). PREFER this for custom objects. Pass { object: "<slug>", fields: { name: "...", ...other fields } }: "name" is the primary field, other keys are that object's fields. Use object.list for slugs.`,
      inputSchema: {
        type: "object",
        properties: {
          object: { type: "string", description: `object slug, e.g. ${allSlugs.slice(0, 6).join(", ")}` },
          fields: { type: "object", description: 'the record fields, e.g. { "name": "Acme", "category": "electronics" }' },
        },
        required: ["object"],
        // tolerate flat fields too (e.g. a declarative form passes { object, message, rating })
        additionalProperties: true,
      },
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.recordsWrite,
      handle: async (args, ctx) => {
        const slug = String(args.object ?? "").trim();
        const fields = flexFields(args);
        const custom = customBySlug.get(slug);
        if (custom) {
          return { created: await insertCustomRecord(db, custom.tableName, fields, ctx.crmUserId as number, ctx.orgId) };
        }
        if ((standardSlugs as string[]).includes(slug)) {
          return { created: await createRecord(db, ctx.orgId, ctx.crmUserId as number, slug as WritableResource, fields) };
        }
        throw new BrokerError("NOT_FOUND", `Unknown object '${slug}'. Call object.list to see available objects.`);
      },
    },
    {
      name: "object.create_many",
      description: `Bulk-create records in ANY object/grid by slug (built-in OR custom) — use this for CSV imports. Pass { object: "<slug>", records: [ { name, ...fields }, ... ] }. Returns created rows + per-row errors. Works for just-created objects too.`,
      inputSchema: objSchema(
        {
          object: { type: "string", description: "object slug" },
          records: { type: "array", description: "array of records, each an object of fields", items: { type: "object" } },
        },
        ["object", "records"],
      ),
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.recordsWrite,
      handle: async (args, ctx) => {
        const slug = String(args.object ?? "").trim();
        const records = Array.isArray(args.records) ? (args.records as unknown[]) : [];
        if (records.length === 0) throw new BrokerError("VALIDATION", "`records` must be a non-empty array.");
        if (records.length > 1000) throw new BrokerError("VALIDATION", "Too many records (max 1000).");
        const custom = customBySlug.get(slug);
        const isStd = (standardSlugs as string[]).includes(slug);
        if (!custom && !isStd)
          throw new BrokerError("NOT_FOUND", `Unknown object '${slug}'. Call object.list to see available objects.`);
        const created: unknown[] = [];
        const errors: { index: number; error: string }[] = [];
        for (let i = 0; i < records.length; i++) {
          try {
            const body = pickFields(records[i]);
            created.push(
              custom
                ? await insertCustomRecord(db, custom.tableName, body, ctx.crmUserId as number, ctx.orgId)
                : await createRecord(db, ctx.orgId, ctx.crmUserId as number, slug as WritableResource, body),
            );
          } catch (e) {
            errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return { created, errors };
      },
    },
    {
      name: "object.update",
      description: `Update ONE record in ANY object/grid by slug + id (built-in OR custom). Generic alternative to object.{slug}.update. Pass { object: "<slug>", id: <number>, fields: { ...only the fields to change } }.`,
      inputSchema: {
        type: "object",
        properties: {
          object: { type: "string", description: "object slug" },
          id: { type: "integer", description: "record id" },
          fields: { type: "object", description: 'fields to change, e.g. { "status": "active" }' },
        },
        required: ["object", "id"],
        additionalProperties: true,
      },
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.recordsWrite,
      handle: async (args, ctx) => {
        const slug = String(args.object ?? "").trim();
        const id = coerceId(args);
        const fields = flexFields(args);
        if (Object.keys(fields).length === 0) throw new BrokerError("VALIDATION", "No fields to update.");
        const custom = customBySlug.get(slug);
        if (custom) {
          const row = await updateCustomRecord(db, custom.tableName, id, ctx.orgId, fields);
          if (!row) throw new BrokerError("NOT_FOUND", `No record with id ${id} in '${slug}'.`);
          return { updated: row };
        }
        if ((standardSlugs as string[]).includes(slug)) {
          const row = await updateRecordById(db, ctx.orgId, slug as WritableResource, id, fields);
          if (!row) throw new BrokerError("NOT_FOUND", `No record with id ${id} in '${slug}'.`);
          return { updated: row };
        }
        throw new BrokerError("NOT_FOUND", `Unknown object '${slug}'. Call object.list to see available objects.`);
      },
    },
    {
      name: "object.delete",
      description: `Permanently delete ONE record from ANY object/grid by slug + id (built-in OR custom). Generic alternative to object.{slug}.delete. Pass { object: "<slug>", id: <number> }.`,
      inputSchema: objSchema(
        {
          object: { type: "string", description: "object slug" },
          id: { type: "integer", description: "record id" },
        },
        ["object", "id"],
      ),
      meta: { source: "native", writes: true },
      requires: PERMISSIONS.recordsDeleteHard,
      handle: async (args, ctx) => {
        const slug = String(args.object ?? "").trim();
        const id = coerceId(args);
        const custom = customBySlug.get(slug);
        if (custom) {
          const ok = await deleteCustomRecord(db, custom.tableName, id, ctx.orgId);
          if (!ok) throw new BrokerError("NOT_FOUND", `No record with id ${id} in '${slug}'.`);
          return { deleted: { id } };
        }
        if ((standardSlugs as string[]).includes(slug)) {
          const row = await deleteRecordById(db, ctx.orgId, slug as WritableResource, id);
          if (!row) throw new BrokerError("NOT_FOUND", `No record with id ${id} in '${slug}'.`);
          return { deleted: { id } };
        }
        throw new BrokerError("NOT_FOUND", `Unknown object '${slug}'. Call object.list to see available objects.`);
      },
    },
  );

  for (const obj of objects) {
    const defs = await listCustomFieldDefs(db, orgId, obj.slug, obj.tableName);
    const props: Record<string, unknown> = {
      name: { type: "string", description: `${obj.singular} name (primary field)` },
    };
    for (const f of defs) props[f.name] = { ...fieldTypeToSchema(f.fieldType, f.options), description: f.label };
    const { slug, singular: sing, plural, tableName: table } = obj;
    const pickBody = (args: Record<string, unknown>): Record<string, unknown> => {
      const body: Record<string, unknown> = {};
      for (const key of Object.keys(props)) if (args[key] !== undefined && args[key] !== null) body[key] = args[key];
      return body;
    };

    tools.push(
      {
        name: `object.${slug}.search`,
        description: `List/search ${plural} (custom object). OMIT query (or pass "") to return ALL ${plural} — use this for "do I have any ${plural}?" / "list my ${plural}". Pass query only to filter by text in a record's name/fields.`,
        inputSchema: searchSchema,
        meta: { source: "native", writes: false },
        handle: async (args, ctx) => ({
          results: await searchCustomRecords(db, ctx.orgId, table, String(args.query ?? "")),
        }),
      },
      {
        name: `object.${slug}.get`,
        description: `Get a single ${sing} (custom object) by id.`,
        inputSchema: getSchema,
        meta: { source: "native", writes: false },
        handle: async (args, ctx) => {
          const row = await getCustomRecord(db, table, ctx.orgId, coerceId(args));
          if (!row) throw new BrokerError("NOT_FOUND", `No ${sing} with id ${args.id}.`);
          return row;
        },
      },
      {
        name: `object.${slug}.create`,
        description: `Create a new ${sing} (custom object).`,
        inputSchema: objSchema(props, []),
        meta: { source: "native", writes: true },
        requires: PERMISSIONS.recordsWrite,
        handle: async (args, ctx) => ({
          created: await insertCustomRecord(db, table, pickBody(args), ctx.crmUserId as number, ctx.orgId),
        }),
      },
      {
        name: `object.${slug}.create_many`,
        description: `Create MULTIPLE ${plural} (custom object) in one call. Pass { records: [...] }, each item a ${sing}. Returns created rows + per-row errors.`,
        inputSchema: objSchema(
          { records: { type: "array", description: `array of ${plural} to create`, items: objSchema(props, []) } },
          ["records"],
        ),
        meta: { source: "native", writes: true },
        requires: PERMISSIONS.recordsWrite,
        handle: async (args, ctx) => {
          const records = Array.isArray(args.records) ? (args.records as Record<string, unknown>[]) : [];
          if (records.length === 0) throw new BrokerError("VALIDATION", "`records` must be a non-empty array.");
          if (records.length > 1000) throw new BrokerError("VALIDATION", "Too many records (max 1000).");
          const created: unknown[] = [];
          const errors: { index: number; error: string }[] = [];
          for (let i = 0; i < records.length; i++) {
            try {
              created.push(
                await insertCustomRecord(db, table, pickBody(records[i] ?? {}), ctx.crmUserId as number, ctx.orgId),
              );
            } catch (e) {
              errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
            }
          }
          return { created, errors };
        },
      },
      {
        name: `object.${slug}.update`,
        description: `Update an existing ${sing} (custom object) by id.`,
        inputSchema: objSchema({ id: { type: "integer" }, ...props }, ["id"]),
        meta: { source: "native", writes: true },
        requires: PERMISSIONS.recordsWrite,
        handle: async (args, ctx) => {
          const id = coerceId(args);
          const body = pickBody(args);
          if (Object.keys(body).length === 0) throw new BrokerError("VALIDATION", "No fields to update.");
          const row = await updateCustomRecord(db, table, id, ctx.orgId, body);
          if (!row) throw new BrokerError("NOT_FOUND", `No ${sing} with id ${id}.`);
          return { updated: row };
        },
      },
      {
        name: `object.${slug}.delete`,
        description: `Permanently delete a ${sing} (custom object) by id.`,
        inputSchema: getSchema,
        meta: { source: "native", writes: true },
        requires: PERMISSIONS.recordsDeleteHard,
        handle: async (args, ctx) => {
          const id = coerceId(args);
          await deleteCustomRecord(db, table, id, ctx.orgId);
          return { deleted: { id } };
        },
      },
    );
  }
  return tools;
}

export function buildTools(db: Db, env: Env): BrokerTool[] {
  return [
    ...buildBespokeTools(db, env),
    ...buildResourceTools(db),
    ...buildContextTools(db, env),
    ...buildConnectionTools(env),
    ...buildAutomationTools(db),
    ...buildWebTools(env),
    ...buildAITools(env),
    ...buildConnectorTools(db),
    ...buildEmailTools(env),
    ...buildFileTools(env),
  ];
}
