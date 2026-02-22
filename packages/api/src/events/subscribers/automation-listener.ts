import { EventBus } from "../bus.js";
import { getQueue, QUEUE_NAMES } from "../../workers/queue.js";
import { db, automations } from "@basicsos/db";
import { eq, and } from "drizzle-orm";
import type { BasicsOSEvent } from "@basicsos/shared";

/** Safely read a nested value from an unknown object using a dot-separated path. */
const getNestedValue = (obj: unknown, path: string): unknown =>
  path.split(".").reduce(
    (curr, key) =>
      curr != null && typeof curr === "object" ? (curr as Record<string, unknown>)[key] : undefined,
    obj,
  );

type Condition = {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "contains";
  value: string | number | boolean;
};

/** Returns true if all conditions pass against the event payload. Empty conditions always pass. */
const evaluateConditions = (conditions: Condition[], payload: unknown): boolean => {
  if (conditions.length === 0) return true;
  return conditions.every(({ field, operator, value }) => {
    const actual = getNestedValue(payload, field);
    switch (operator) {
      case "eq":
        return actual === value;
      case "neq":
        return actual !== value;
      case "gt":
        return Number(actual) > Number(value);
      case "lt":
        return Number(actual) < Number(value);
      case "contains":
        return typeof actual === "string" && actual.includes(String(value));
      default:
        return false;
    }
  });
};

const shouldTrigger = (automation: { triggerConfig: unknown }, event: BasicsOSEvent): boolean => {
  if (!automation.triggerConfig || typeof automation.triggerConfig !== "object") return false;
  const config = automation.triggerConfig as Record<string, unknown>;

  if (typeof config["eventType"] !== "string" || config["eventType"] !== event.type) return false;

  const conditions = Array.isArray(config["conditions"]) ? (config["conditions"] as Condition[]) : [];
  return evaluateConditions(conditions, event.payload);
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
              triggerPayload: event.payload as Record<string, unknown>,
              triggerUserId: event.userId, // forward event user for task creation, etc.
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
