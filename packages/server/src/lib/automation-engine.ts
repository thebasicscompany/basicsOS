import { PgBoss, type Job } from "pg-boss";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import * as schema from "@/db/schema/index.js";
import { eq, and } from "drizzle-orm";
import { executeWorkflow } from "@/lib/automation-executor.js";
import { logger } from "@/lib/logger.js";

const log = logger.child({ component: "automation-engine" });

export interface WorkflowDefinition {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

let _boss: PgBoss | null = null;
let _db: Db | null = null;
let _env: Env | null = null;

export async function startAutomationEngine(database: Db, environment: Env) {
  _db = database;
  _env = environment;

  _boss = new PgBoss(environment.DATABASE_URL);

  _boss.on("error", (err: unknown) => {
    log.error({ err }, "pg-boss error");
  });

  await _boss.start();

  await _boss.createQueue("run-automation");

  type RunJobData = { ruleId: number; crmUserId: number; triggerData: Record<string, unknown> };
  await _boss.work<RunJobData>(
    "run-automation",
    { localConcurrency: 3 },
    async (jobs: Job<RunJobData>[]) => {
      for (const job of jobs) {
        const { ruleId, crmUserId, triggerData } = job.data;
        await runAutomation(ruleId, crmUserId, triggerData);
      }
    },
  );

  // Load and register schedule-triggered rules
  await loadScheduleRules();

  log.info("Automation engine started");
}

/** Gracefully stop the automation engine. Waits for in-flight jobs up to timeout. */
export async function stopAutomationEngine(): Promise<void> {
  if (!_boss) return;
  try {
    await _boss.stop({ graceful: true, timeout: 30_000 });
    log.info("Automation engine stopped");
  } catch (err) {
    log.error({ err }, "Automation engine stop error");
  } finally {
    _boss = null;
  }
}

async function loadScheduleRules() {
  if (!_db) return;
   
  const rules: any[] = await (_db as any)
    .select()
    .from(schema.automationRules)
    .where(eq(schema.automationRules.enabled, true));

  for (const rule of rules) {
    const def = rule.workflowDefinition as WorkflowDefinition;
    const triggerNode = def?.nodes?.find((n) => n.type === "trigger_schedule");
    if (triggerNode) {
      const cron = (triggerNode.data as { cron?: string }).cron;
      if (cron) {
        await registerScheduleRule(rule.id as number, rule.crmUserId as number, cron);
      }
    }
  }
}

/** Resolve a user's effective schedule timezone: user override -> org default -> UTC. */
async function resolveTimezone(crmUserId: number): Promise<string> {
  if (!_db) return "UTC";
  const db = _db as any;
  try {
    const [u] = await db
      .select({ tz: schema.crmUsers.timezone, orgId: schema.crmUsers.organizationId })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.id, crmUserId))
      .limit(1);
    if (u?.tz) return u.tz;
    if (u?.orgId) {
      const [org] = await db
        .select({ tz: schema.organizations.timezone })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, u.orgId))
        .limit(1);
      if (org?.tz) return org.tz;
    }
  } catch {
    /* fall through to UTC */
  }
  return "UTC";
}

async function registerScheduleRule(ruleId: number, crmUserId: number, cron: string) {
  if (!_boss) return;
  const queueName = `rule-schedule-${ruleId}`;

  try {
    await _boss.createQueue(queueName);
    // Schedule fires in the OWNER's timezone (per-user override, else org default).
    const tz = await resolveTimezone(crmUserId);
    await _boss.schedule(queueName, cron, { ruleId, crmUserId }, { tz });
    await _boss.work(queueName, async (jobs: Array<{ data: unknown }>) => {
      for (const job of jobs) {
        const data = job.data as { ruleId: number; crmUserId: number };
        await runAutomation(data.ruleId, data.crmUserId, {});
      }
    });
  } catch (err) {
    log.error({ err, ruleId }, "Failed to register schedule for rule");
  }
}

export async function reloadRule(ruleId: number) {
  if (!_boss || !_db) return;

  // Remove existing schedule
  try {
    await _boss.unschedule(`rule-schedule-${ruleId}`);
  } catch {
    // Schedule may not exist, ignore
  }

   
  const rules: any[] = await (_db as any)
    .select()
    .from(schema.automationRules)
    .where(eq(schema.automationRules.id, ruleId))
    .limit(1);
  const rule = rules[0];

  if (rule?.enabled) {
    const def = rule.workflowDefinition as WorkflowDefinition;
    const triggerNode = def?.nodes?.find((n: { type: string }) => n.type === "trigger_schedule");
    if (triggerNode) {
      const cron = (triggerNode.data as { cron?: string }).cron;
      if (cron) {
        await registerScheduleRule(ruleId, rule.crmUserId as number, cron);
      }
    }
  }
}

interface TriggerFilter { field: string; op: string; value: unknown }
interface TriggerEventData { event?: string; recordId?: number; filter?: TriggerFilter; filters?: TriggerFilter[] }

/** The record id carried by an event payload, across the various event shapes. */
function recordIdOf(payload: Record<string, unknown>): unknown {
  return payload.dealId ?? payload.contactId ?? payload.taskId ?? payload.companyId ?? payload.id;
}

function applyOp(actual: unknown, op: string, value: unknown): boolean {
  switch (op) {
    case "eq": return actual === value;
    case "ne": return actual !== value;
    case "gt": return Number(actual) > Number(value);
    case "gte": return Number(actual) >= Number(value);
    case "lt": return Number(actual) < Number(value);
    case "lte": return Number(actual) <= Number(value);
    case "in": return Array.isArray(value) && (value as unknown[]).includes(actual);
    case "contains": return String(actual ?? "").toLowerCase().includes(String(value ?? "").toLowerCase());
    default: return false;
  }
}

/** Record-scoping/filter gate: a trigger only fires when its recordId + filter(s) match the payload. */
function matchesScope(data: TriggerEventData, payload: Record<string, unknown>): boolean {
  if (data.recordId != null) {
    const id = recordIdOf(payload);
    if (id == null || Number(id) !== Number(data.recordId)) return false;
  }
  const filters = data.filters ?? (data.filter ? [data.filter] : []);
  for (const f of filters) {
    if (!f?.field) return false; // fail-closed on a malformed filter
    if (!applyOp(payload[f.field], f.op, f.value)) return false;
  }
  return true;
}

export async function fireEvent(
  event: string,
  payload: Record<string, unknown>,
  crmUserId: number,
) {
  if (!_boss || !_db) return;

  try {
     
    const rules: any[] = await (_db as any)
      .select()
      .from(schema.automationRules)
      .where(and(eq(schema.automationRules.crmUserId, crmUserId), eq(schema.automationRules.enabled, true)));

    for (const rule of rules) {
      const def = rule.workflowDefinition as WorkflowDefinition;
      const triggerNode = def?.nodes?.find((n: { type: string }) => n.type === "trigger_event");
      if (triggerNode) {
        const data = triggerNode.data as TriggerEventData;
        if (data.event === event && matchesScope(data, payload)) {
          await _boss.send("run-automation", {
            ruleId: rule.id as number,
            crmUserId,
            triggerData: payload,
          });
        }
      }
    }
  } catch (err) {
    log.error({ err, event, crmUserId }, "fireEvent error");
  }
}

/** Trigger a manual run for a specific rule. Sends job to run-automation queue. */
export async function triggerRunNow(ruleId: number, crmUserId: number): Promise<boolean> {
  if (!_boss) return false;
  try {
    await _boss.send("run-automation", {
      ruleId,
      crmUserId,
      triggerData: { manual: true },
    });
    return true;
  } catch (err) {
    log.error({ err, ruleId, crmUserId }, "triggerRunNow error");
    return false;
  }
}

async function runAutomation(
  ruleId: number,
  crmUserId: number,
  triggerData: Record<string, unknown>,
) {
  if (!_db || !_env) return;

  const db = _db as any;

  const rules: any[] = await db
    .select()
    .from(schema.automationRules)
    .where(eq(schema.automationRules.id, ruleId))
    .limit(1);
  const rule = rules[0];

  if (!rule) throw new Error(`Rule ${ruleId} not found`);

  let orgId = rule.organizationId ?? rule.organization_id ?? null;
  if (orgId == null) {
    const [crmUser] = await db
      .select({ organizationId: schema.crmUsers.organizationId })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.id, crmUserId))
      .limit(1);
    orgId = crmUser?.organizationId ?? null;
  }

  const [run] = await db
    .insert(schema.automationRuns)
    .values({
      ruleId,
      crmUserId,
      organizationId: orgId,
      status: "running",
    })
    .returning();

  try {
    const crmUserRows: any[] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.id, crmUserId))
      .limit(1);
    const crmUserRow = crmUserRows[0];

    if (!crmUserRow) throw new Error(`CRM user ${crmUserId} not found`);

    const result = await executeWorkflow(
      rule.workflowDefinition as WorkflowDefinition,
      triggerData,
      { id: crmUserRow.id as number, organizationId: (crmUserRow.organizationId ?? crmUserRow.organization_id ?? null) as string | null },
      _db!,
      _env!,
      ruleId,
    );

    await db
      .update(schema.automationRuns)
      .set({ status: "success", result, finishedAt: new Date() })
      .where(eq(schema.automationRuns.id, run.id));

    await db
      .update(schema.automationRules)
      .set({ lastRunAt: new Date() })
      .where(eq(schema.automationRules.id, ruleId));
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ err, runId: run?.id, ruleId, crmUserId }, "Automation run failed");
    if (run?.id != null) {
      await (db)
        .update(schema.automationRuns)
        .set({ status: "error", error, finishedAt: new Date() })
        .where(eq(schema.automationRuns.id, run.id));
    }
  }
}
