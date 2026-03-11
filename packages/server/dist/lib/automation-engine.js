import { PgBoss } from "pg-boss";
import * as schema from "@/db/schema/index.js";
import { eq, and } from "drizzle-orm";
import { executeWorkflow } from "@/lib/automation-executor.js";
import { logger } from "@/lib/logger.js";
const log = logger.child({ component: "automation-engine" });
let _boss = null;
let _db = null;
let _env = null;
export async function startAutomationEngine(database, environment) {
    _db = database;
    _env = environment;
    _boss = new PgBoss(environment.DATABASE_URL);
    _boss.on("error", (err) => {
        log.error({ err }, "pg-boss error");
    });
    await _boss.start();
    await _boss.createQueue("run-automation");
    await _boss.work("run-automation", { localConcurrency: 3 }, async (jobs) => {
        for (const job of jobs) {
            const { ruleId, crmUserId, triggerData } = job.data;
            await runAutomation(ruleId, crmUserId, triggerData);
        }
    });
    // Load and register schedule-triggered rules
    await loadScheduleRules();
    log.info("Automation engine started");
}
/** Gracefully stop the automation engine. Waits for in-flight jobs up to timeout. */
export async function stopAutomationEngine() {
    if (!_boss)
        return;
    try {
        await _boss.stop({ graceful: true, timeout: 30_000 });
        log.info("Automation engine stopped");
    }
    catch (err) {
        log.error({ err }, "Automation engine stop error");
    }
    finally {
        _boss = null;
    }
}
async function loadScheduleRules() {
    if (!_db)
        return;
    const rules = await _db
        .select()
        .from(schema.automationRules)
        .where(eq(schema.automationRules.enabled, true));
    for (const rule of rules) {
        const def = rule.workflowDefinition;
        const triggerNode = def?.nodes?.find((n) => n.type === "trigger_schedule");
        if (triggerNode) {
            const cron = triggerNode.data.cron;
            if (cron) {
                await registerScheduleRule(rule.id, rule.crmUserId, cron);
            }
        }
    }
}
async function registerScheduleRule(ruleId, crmUserId, cron) {
    if (!_boss)
        return;
    const queueName = `rule-schedule-${ruleId}`;
    try {
        await _boss.createQueue(queueName);
        await _boss.schedule(queueName, cron, { ruleId, crmUserId });
        await _boss.work(queueName, async (jobs) => {
            for (const job of jobs) {
                const data = job.data;
                await runAutomation(data.ruleId, data.crmUserId, {});
            }
        });
    }
    catch (err) {
        log.error({ err, ruleId }, "Failed to register schedule for rule");
    }
}
export async function reloadRule(ruleId) {
    if (!_boss || !_db)
        return;
    // Remove existing schedule
    try {
        await _boss.unschedule(`rule-schedule-${ruleId}`);
    }
    catch {
        // Schedule may not exist, ignore
    }
    const rules = await _db
        .select()
        .from(schema.automationRules)
        .where(eq(schema.automationRules.id, ruleId))
        .limit(1);
    const rule = rules[0];
    if (rule?.enabled) {
        const def = rule.workflowDefinition;
        const triggerNode = def?.nodes?.find((n) => n.type === "trigger_schedule");
        if (triggerNode) {
            const cron = triggerNode.data.cron;
            if (cron) {
                await registerScheduleRule(ruleId, rule.crmUserId, cron);
            }
        }
    }
}
export async function fireEvent(event, payload, crmUserId) {
    if (!_boss || !_db)
        return;
    try {
        const rules = await _db
            .select()
            .from(schema.automationRules)
            .where(and(eq(schema.automationRules.crmUserId, crmUserId), eq(schema.automationRules.enabled, true)));
        for (const rule of rules) {
            const def = rule.workflowDefinition;
            const triggerNode = def?.nodes?.find((n) => n.type === "trigger_event");
            if (triggerNode) {
                const triggerEvent = triggerNode.data.event;
                if (triggerEvent === event) {
                    await _boss.send("run-automation", {
                        ruleId: rule.id,
                        crmUserId,
                        triggerData: payload,
                    });
                }
            }
        }
    }
    catch (err) {
        log.error({ err, event, crmUserId }, "fireEvent error");
    }
}
/** Trigger a manual run for a specific rule. Sends job to run-automation queue. */
export async function triggerRunNow(ruleId, crmUserId) {
    if (!_boss)
        return false;
    try {
        await _boss.send("run-automation", {
            ruleId,
            crmUserId,
            triggerData: { manual: true },
        });
        return true;
    }
    catch (err) {
        log.error({ err, ruleId, crmUserId }, "triggerRunNow error");
        return false;
    }
}
async function runAutomation(ruleId, crmUserId, triggerData) {
    if (!_db || !_env)
        return;
    const db = _db;
    const rules = await db
        .select()
        .from(schema.automationRules)
        .where(eq(schema.automationRules.id, ruleId))
        .limit(1);
    const rule = rules[0];
    if (!rule)
        throw new Error(`Rule ${ruleId} not found`);
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
        const crmUserRows = await db
            .select()
            .from(schema.crmUsers)
            .where(eq(schema.crmUsers.id, crmUserId))
            .limit(1);
        const crmUserRow = crmUserRows[0];
        if (!crmUserRow)
            throw new Error(`CRM user ${crmUserId} not found`);
        const result = await executeWorkflow(rule.workflowDefinition, triggerData, { id: crmUserRow.id, organizationId: (crmUserRow.organizationId ?? crmUserRow.organization_id ?? null) }, _db, _env);
        await db
            .update(schema.automationRuns)
            .set({ status: "success", result, finishedAt: new Date() })
            .where(eq(schema.automationRuns.id, run.id));
        await db
            .update(schema.automationRules)
            .set({ lastRunAt: new Date() })
            .where(eq(schema.automationRules.id, ruleId));
    }
    catch (err) {
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
