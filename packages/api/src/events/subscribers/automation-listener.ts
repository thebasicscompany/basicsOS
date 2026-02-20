import { EventBus } from "../bus.js";
import { getQueue, QUEUE_NAMES } from "../../workers/queue.js";
import { db, automations } from "@basicsos/db";
import { eq, and } from "drizzle-orm";
import type { BasicsOSEvent } from "@basicsos/shared";

const shouldTrigger = (automation: { triggerConfig: unknown }, event: BasicsOSEvent): boolean => {
  // Safe runtime check — triggerConfig is JSONB from DB, validate before accessing
  if (!automation.triggerConfig || typeof automation.triggerConfig !== "object") return false;
  const config = automation.triggerConfig as Record<string, unknown>;
  return typeof config["eventType"] === "string" && config["eventType"] === event.type;
};

export const registerAutomationListener = (): void => {
  const queue = getQueue(QUEUE_NAMES.AUTOMATION_EXECUTOR);

  EventBus.onAny(async (event) => {
    try {
      const matchingAutomations = await db
        .select()
        .from(automations)
        .where(and(eq(automations.tenantId, event.tenantId), eq(automations.enabled, true)));

      for (const automation of matchingAutomations) {
        if (shouldTrigger(automation, event)) {
          queue
            .add("run-automation", {
              tenantId: event.tenantId,
              automationId: automation.id,
              triggerPayload: event.payload,
            })
            .catch((err: unknown) => {
              console.error("[automation-listener] Failed to enqueue:", err);
            });
        }
      }
    } catch (err: unknown) {
      console.error("[automation-listener] Error:", err);
    }
  });
};
