import type { Db } from "../db/client.js";
import * as schema from "../db/schema/index.js";

type AuditInput = {
  crmUserId?: number | null;
  organizationId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | number | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeAuditLog(db: Db, input: AuditInput): Promise<void> {
  await db.insert(schema.auditLogs).values({
    crmUserId: input.crmUserId ?? null,
    organizationId: input.organizationId ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId == null ? null : String(input.entityId),
    metadata: input.metadata ?? {},
  });
}

export async function writeAuditLogSafe(db: Db, input: AuditInput): Promise<void> {
  try {
    await writeAuditLog(db, input);
  } catch (err) {
    console.error("[audit-log] failed:", err);
  }
}
