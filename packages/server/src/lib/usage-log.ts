import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";

export type UsageLogInput = {
  organizationId: string;
  crmUserId: number;
  feature: string;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number | null;
};

export async function writeUsageLog(
  db: Db,
  input: UsageLogInput,
): Promise<void> {
  await db.insert(schema.aiUsageLogs).values({
    organizationId: input.organizationId,
    crmUserId: input.crmUserId,
    feature: input.feature,
    model: input.model ?? null,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    durationMs: input.durationMs ?? null,
  });
}

export async function writeUsageLogSafe(
  db: Db,
  input: UsageLogInput,
): Promise<void> {
  try {
    await writeUsageLog(db, input);
  } catch (err) {
    console.error("[usage-log] failed:", err);
  }
}
