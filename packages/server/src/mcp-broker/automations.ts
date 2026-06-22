// automation.* tools — let the agent author per-user automations from chat.
// The agent supplies a name, a schedule (cron) or event, and a natural-language
// prompt; we compile that to a WorkflowDefinition (trigger -> agentic step),
// store it owned by the acting user (crm_user_id), and register the schedule
// (which fires in the user's timezone). The agentic step runs back through hermes
// + the Broker at run time, so it acts AS the owner with their tools/connections.
// See docs/PLATFORM…md §8 (automations) + BUILD_PLAN_HERMES.md M6.

import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { reloadRule, triggerRunNow } from "@/lib/automation-engine.js";
import type { BrokerTool } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";

interface TriggerFilter {
  field: string;
  op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: unknown;
}
interface CreateInput {
  name: string;
  prompt: string;
  cron?: string;
  event?: string;
  recordId?: number; // scope an event automation to a single record (e.g. one deal)
  filter?: TriggerFilter; // only run when the event payload matches this predicate
}

function buildWorkflowDefinition(input: CreateInput) {
  const trigger = input.cron
    ? { id: "trigger", type: "trigger_schedule", position: { x: 0, y: 0 }, data: { cron: input.cron } }
    : {
        id: "trigger",
        type: "trigger_event",
        position: { x: 0, y: 0 },
        data: {
          event: input.event,
          ...(input.recordId != null ? { recordId: input.recordId } : {}),
          ...(input.filter ? { filter: input.filter } : {}),
        },
      };
  return {
    nodes: [
      trigger,
      { id: "agent", type: "action_ai_agent", position: { x: 0, y: 140 }, data: { prompt: input.prompt } },
    ],
    edges: [{ id: "e1", source: "trigger", target: "agent" }],
  };
}

async function ownRule(db: Db, orgId: string, crmUserId: number, id: number) {
  const [rule] = await db
    .select()
    .from(schema.automationRules)
    .where(
      and(
        eq(schema.automationRules.id, id),
        eq(schema.automationRules.crmUserId, crmUserId),
        eq(schema.automationRules.organizationId, orgId),
      ),
    )
    .limit(1);
  return rule ?? null;
}

// Shared schema for the optional record-scope / filter on event automations.
const SCOPE_PROPS = {
  recordId: { type: "integer", description: "scope to a single record id (e.g. one specific deal)" },
  filter: {
    type: "object",
    description: 'only run when the event payload matches, e.g. {field:"newStatus",op:"eq",value:"won"} or {field:"amount",op:"gt",value:50000}',
    properties: {
      field: { type: "string" },
      op: { type: "string", enum: ["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains"] },
      value: {},
    },
    required: ["field", "op", "value"],
    additionalProperties: false,
  },
} as const;

function parseFilter(raw: unknown): TriggerFilter | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.field !== "string" || typeof o.op !== "string") return undefined;
  return { field: o.field, op: o.op as TriggerFilter["op"], value: o.value };
}

export function buildAutomationTools(db: Db): BrokerTool[] {
  return [
    {
      name: "automation.create",
      description:
        "Create a scheduled or event-triggered automation owned by the current user. Provide a name, a `cron` schedule (5-field cron, e.g. \"0 9 * * 1\" = every Monday 9am — fires in the user's timezone) OR an `event`, and a natural-language `prompt`. For event automations you can SCOPE it: `recordId` ties it to one record (e.g. a specific deal), and/or `filter` only runs when the payload matches (e.g. only when a deal is won, or its amount > 50000). deal.stage_changed payload fields: dealId, newStatus, oldStatus, amount, companyId.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          prompt: { type: "string", description: "what to do each run, e.g. 'summarize my open deals and email me'" },
          cron: { type: "string", description: "5-field cron in the user's timezone, e.g. 0 9 * * 1" },
          event: { type: "string", description: "alternative to cron: an event name to trigger on" },
          ...SCOPE_PROPS,
        },
        required: ["name", "prompt"],
        additionalProperties: false,
      },
      meta: { source: "system", writes: true },
      handle: async (args, ctx) => {
        const name = String(args.name ?? "").trim();
        const prompt = String(args.prompt ?? "").trim();
        const cron = args.cron ? String(args.cron).trim() : undefined;
        const event = args.event ? String(args.event).trim() : undefined;
        const recordId = args.recordId != null ? Number(args.recordId) : undefined;
        const filter = parseFilter(args.filter);
        if (!name || !prompt) throw new BrokerError("VALIDATION", "`name` and `prompt` are required.");
        if (!cron && !event) throw new BrokerError("VALIDATION", "Provide a `cron` schedule or an `event`.");
        const workflowDefinition = buildWorkflowDefinition({ name, prompt, cron, event, recordId, filter });
        const [rule] = await db
          .insert(schema.automationRules)
          .values({
            crmUserId: ctx.crmUserId as number,
            organizationId: ctx.orgId,
            name,
            enabled: true,
            workflowDefinition,
          })
          .returning();
        await reloadRule(rule.id); // register the schedule (in the user's tz)
        return { created: { id: rule.id, name, cron, event, recordId, filter, prompt, enabled: true } };
      },
    },
    {
      name: "automation.update",
      description:
        "Edit one of the current user's automations from chat — change its `name`, schedule (`cron`), `event`, `recordId`/`filter` scope, the `prompt`, and/or `enabled`. Pass only the fields to change. Giving a cron clears any event and vice-versa.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          cron: { type: "string", description: "new 5-field cron in the user's tz, e.g. 0 17 * * 5" },
          event: { type: "string", description: "new event name (alternative to cron)" },
          prompt: { type: "string", description: "new instructions for what it does each run" },
          enabled: { type: "boolean" },
          ...SCOPE_PROPS,
        },
        required: ["id"],
        additionalProperties: false,
      },
      meta: { source: "system", writes: true },
      handle: async (args, ctx) => {
        const id = Number(args.id);
        const rule = await ownRule(db, ctx.orgId, ctx.crmUserId as number, id);
        if (!rule) throw new BrokerError("NOT_FOUND", `No automation with id ${args.id}.`);
        const def = (rule.workflowDefinition ?? {}) as {
          nodes?: Array<{ type?: string; data?: Record<string, unknown> }>;
        };
        const nodes = def.nodes ?? [];
        const evNode = nodes.find((n) => n.type === "trigger_event")?.data ?? {};
        const curCron = nodes.find((n) => n.type === "trigger_schedule")?.data?.cron as string | undefined;
        const curEvent = evNode.event as string | undefined;
        const curPrompt = nodes.find((n) => n.type === "action_ai_agent")?.data?.prompt as string | undefined;

        const name = args.name != null ? String(args.name).trim() : rule.name;
        const prompt = args.prompt != null ? String(args.prompt).trim() : curPrompt ?? "";
        // A new cron replaces an event trigger and vice-versa.
        let cron = args.cron != null ? String(args.cron).trim() : curCron;
        let event = args.event != null ? String(args.event).trim() : curEvent;
        if (args.cron != null) event = undefined;
        if (args.event != null) cron = undefined;
        if (!cron && !event) throw new BrokerError("VALIDATION", "Automation needs a `cron` schedule or an `event`.");
        if (!prompt) throw new BrokerError("VALIDATION", "Automation needs a `prompt`.");
        // Preserve or update record-scope/filter (only meaningful for event triggers).
        const recordId =
          "recordId" in args ? (args.recordId != null ? Number(args.recordId) : undefined) : (evNode.recordId as number | undefined);
        const filter = "filter" in args ? parseFilter(args.filter) : (evNode.filter as TriggerFilter | undefined);

        const workflowDefinition = buildWorkflowDefinition({ name, prompt, cron, event, recordId, filter });
        const enabled = typeof args.enabled === "boolean" ? args.enabled : rule.enabled;
        await db
          .update(schema.automationRules)
          .set({ name, workflowDefinition, enabled })
          .where(eq(schema.automationRules.id, id));
        await reloadRule(id); // re-register the schedule (handles cron/tz/enable changes)
        return { updated: { id, name, cron, event, recordId, filter, prompt, enabled } };
      },
    },
    {
      name: "automation.list",
      description: "List the current user's automations (id, name, enabled, last run).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      meta: { source: "system", writes: false },
      handle: async (_args, ctx) => {
        if (ctx.crmUserId == null) return { automations: [] };
        const rows = await db
          .select({
            id: schema.automationRules.id,
            name: schema.automationRules.name,
            enabled: schema.automationRules.enabled,
            lastRunAt: schema.automationRules.lastRunAt,
            workflowDefinition: schema.automationRules.workflowDefinition,
          })
          .from(schema.automationRules)
          .where(
            and(
              eq(schema.automationRules.crmUserId, ctx.crmUserId),
              eq(schema.automationRules.organizationId, ctx.orgId),
            ),
          )
          .orderBy(desc(schema.automationRules.createdAt));
        return { automations: rows };
      },
    },
    {
      name: "automation.run_now",
      description: "Run one of the current user's automations immediately (manual trigger).",
      inputSchema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"], additionalProperties: false },
      meta: { source: "system", writes: true },
      handle: async (args, ctx) => {
        const id = Number(args.id);
        const rule = await ownRule(db, ctx.orgId, ctx.crmUserId as number, id);
        if (!rule) throw new BrokerError("NOT_FOUND", `No automation with id ${args.id}.`);
        const ok = await triggerRunNow(id, ctx.crmUserId as number);
        return { triggered: ok, id };
      },
    },
    {
      name: "automation.set_enabled",
      description: "Enable or disable one of the current user's automations.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "integer" }, enabled: { type: "boolean" } },
        required: ["id", "enabled"],
        additionalProperties: false,
      },
      meta: { source: "system", writes: true },
      handle: async (args, ctx) => {
        const id = Number(args.id);
        const rule = await ownRule(db, ctx.orgId, ctx.crmUserId as number, id);
        if (!rule) throw new BrokerError("NOT_FOUND", `No automation with id ${args.id}.`);
        await db
          .update(schema.automationRules)
          .set({ enabled: Boolean(args.enabled), updatedAt: new Date() })
          .where(eq(schema.automationRules.id, id));
        await reloadRule(id);
        return { id, enabled: Boolean(args.enabled) };
      },
    },
    {
      name: "automation.delete",
      description: "Delete one of the current user's automations.",
      inputSchema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"], additionalProperties: false },
      meta: { source: "system", writes: true },
      handle: async (args, ctx) => {
        const id = Number(args.id);
        const rule = await ownRule(db, ctx.orgId, ctx.crmUserId as number, id);
        if (!rule) throw new BrokerError("NOT_FOUND", `No automation with id ${args.id}.`);
        await db.update(schema.automationRules).set({ enabled: false }).where(eq(schema.automationRules.id, id));
        await reloadRule(id); // unschedules (rule now disabled)
        await db.delete(schema.automationRules).where(eq(schema.automationRules.id, id));
        return { deleted: { id } };
      },
    },
  ];
}
