import { EventBus } from "../bus.js";
import { db } from "@basicsos/db";
import { auditLog } from "@basicsos/db";
import type { BasicsOSEvent } from "@basicsos/shared";
import { createLogger } from "@basicsos/shared";

const logger = createLogger("audit-logger");

const logToAudit = async (event: BasicsOSEvent): Promise<void> => {
  try {
    await db.insert(auditLog).values({
      tenantId: event.tenantId,
      userId: event.userId ?? null,
      action: event.type,
      resourceType: event.type.split(".")[0] ?? "system",
      resourceId: null, // Resource ID available in module-specific audit hooks
      metadata: { payload: event.payload },
    });
  } catch (err) {
    // Audit logging must never throw — silently log the failure
    logger.error(
      { err, eventType: event.type, tenantId: event.tenantId },
      "Failed to write audit log",
    );
  }
};

export const registerAuditLogger = (): void => {
  // onAny receives every event — correct pattern for cross-cutting concerns
  EventBus.onAny((event) => {
    void logToAudit(event);
  });
};
