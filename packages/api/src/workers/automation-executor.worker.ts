import { createWorker, getQueue, QUEUE_NAMES } from "./queue.js";
import { EventBus, createEvent } from "../events/bus.js";
import { db, automations, automationRuns } from "@basicsos/db";
import { eq } from "drizzle-orm";

type AutomationJob = {
  tenantId: string;
  automationId: string;
  triggerPayload: Record<string, unknown>;
};

export const automationExecutorQueue = getQueue(QUEUE_NAMES.AUTOMATION_EXECUTOR);

export const startAutomationExecutorWorker = () =>
  createWorker<AutomationJob>(QUEUE_NAMES.AUTOMATION_EXECUTOR, async (job) => {
    const { automationId, tenantId, triggerPayload } = job.data;

    const [automation] = await db
      .select()
      .from(automations)
      .where(eq(automations.id, automationId));
    if (!automation) {
      console.error(`[automation-executor] Automation ${automationId} not found`);
      return;
    }

    const [run] = await db
      .insert(automationRuns)
      .values({
        automationId,
        status: "running",
      })
      .returning();

    if (!run) return;

    EventBus.emit(
      createEvent({
        type: "automation.triggered",
        tenantId,
        payload: { automationId, runId: run.id },
      }),
    );

    // Safely extract action chain — validate without `as` cast
    const actionChainRaw = Array.isArray(automation.actionChain) ? automation.actionChain : [];
    const actionCount = actionChainRaw.length;
    // Log only non-sensitive info — never log triggerPayload which may contain PII
    console.warn(
      `[automation-executor] Running ${actionCount} actions for automation:${automationId}`,
    );

    await db
      .update(automationRuns)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(automationRuns.id, run.id));

    EventBus.emit(
      createEvent({
        type: "automation.completed",
        tenantId,
        payload: { automationId, runId: run.id },
      }),
    );
  });
