import { eq } from "drizzle-orm";
import { db, automations, automationRuns } from "@basicsos/db";
import { EventBus, createEvent } from "../events/bus.js";
import { actionSchema } from "@basicsos/shared";
import { createWorker, getQueue, QUEUE_NAMES } from "./queue.js";
import { executeAction, type ActionResult } from "./automation-actions/index.js";

type AutomationJob = {
  tenantId: string;
  automationId: string;
  triggerPayload: Record<string, unknown>;
  /** User ID from the triggering event — used as task creator, etc. May be undefined. */
  triggerUserId?: string;
};

export const automationExecutorQueue = getQueue(QUEUE_NAMES.AUTOMATION_EXECUTOR);

export const startAutomationExecutorWorker = () =>
  createWorker<AutomationJob>(QUEUE_NAMES.AUTOMATION_EXECUTOR, async (job) => {
    const { automationId, tenantId, triggerPayload, triggerUserId } = job.data;
    const startedAt = Date.now();

    // 1. Fetch and validate the automation
    const [automation] = await db
      .select()
      .from(automations)
      .where(eq(automations.id, automationId));

    if (!automation) {
      console.error(`[automation-executor] Automation ${automationId} not found`);
      return;
    }

    // 2. Parse the action chain via Zod — safe runtime validation of JSONB
    const actionChainRaw = Array.isArray(automation.actionChain) ? automation.actionChain : [];
    const actionChain = actionChainRaw.flatMap((raw) => {
      const result = actionSchema.safeParse(raw);
      return result.success ? [result.data] : [];
    });

    // 3. Create a run record in 'running' state (explicit startedAt for reliable duration math)
    const [run] = await db
      .insert(automationRuns)
      .values({ automationId, status: "running", startedAt: new Date() })
      .returning();

    if (!run) {
      console.error(`[automation-executor] Failed to create run for automation ${automationId}`);
      return;
    }

    EventBus.emit(
      createEvent({
        type: "automation.triggered",
        tenantId,
        payload: { automationId, runId: run.id },
      }),
    );

    // 4. Execute the action chain — CCX-style: sequential, fail-fast, per-action result capture
    const actionResults: ActionResult[] = [];
    let chainFailed = false;

    for (const action of actionChain) {
      const result = await executeAction(action, {
        tenantId,
        triggerPayload,
        triggerUserId,
        db,
      });
      actionResults.push(result);

      if (result.status === "failed") {
        // Halt the chain on first failure — quality-gate pattern from CCX
        chainFailed = true;
        break;
      }
    }

    // 5. Build the completion report — stored in automationRuns.result JSONB
    const completionReport = {
      actionsExecuted: actionResults.length,
      actionResults,
      executionTimeMs: Date.now() - startedAt,
      triggerPayload,
    };

    const finalStatus = chainFailed ? "failed" : "completed";
    const failedAction = chainFailed ? actionResults.at(-1) : undefined;

    // 6. Persist the run outcome
    await db
      .update(automationRuns)
      .set({
        status: finalStatus,
        completedAt: new Date(),
        result: completionReport,
        error: failedAction?.error ?? null,
      })
      .where(eq(automationRuns.id, run.id));

    // 7. Update lastRunAt on the automation itself
    await db
      .update(automations)
      .set({ lastRunAt: new Date() })
      .where(eq(automations.id, automationId));

    // 8. Emit outcome event (automation.failed was previously never emitted — now it is)
    if (chainFailed && failedAction) {
      EventBus.emit(
        createEvent({
          type: "automation.failed",
          tenantId,
          payload: { automationId, runId: run.id, error: failedAction.error ?? "Unknown error" },
        }),
      );
    } else {
      EventBus.emit(
        createEvent({
          type: "automation.completed",
          tenantId,
          payload: { automationId, runId: run.id },
        }),
      );
    }

    console.info(
      `[automation-executor] automation:${automationId} run:${run.id} → ${finalStatus} (${actionResults.length} actions, ${Date.now() - startedAt}ms)`,
    );
  });
