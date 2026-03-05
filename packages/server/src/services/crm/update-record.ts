import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import { buildEntityText, getEntityType, upsertEntityEmbedding } from "@/lib/embeddings.js";
import { fireEvent, reloadRule } from "@/lib/automation-engine.js";
import { resolveStoredApiKey } from "@/lib/api-key-crypto.js";
import { updateRecord } from "@/data-access/crm/update.js";
import { getWriteAllowlist } from "@/routes/crm/handlers/field-allowlists.js";
import { validateWritePayload } from "@/schemas/crm/write-payloads.js";
import type { Resource } from "@/routes/crm/constants.js";

export interface UpdateRecordInput {
  resource: Resource;
  id: number;
  body: Record<string, unknown>;
  orgId: string;
  crmUserId: number;
  crmUserRow: Record<string, unknown>;
}

export type UpdateRecordResult =
  | { success: true; record: Record<string, unknown> }
  | { success: false; error: string };

export async function updateRecordService(
  db: Db,
  env: Env,
  input: UpdateRecordInput,
): Promise<UpdateRecordResult> {
  const { resource, id, body, orgId, crmUserId, crmUserRow } = input;

  const validated = validateWritePayload(resource, "update", body);
  if (!validated.success) return { success: false, error: validated.error };

  const allowedFields = getWriteAllowlist(resource);
  if (allowedFields.size === 0) {
    return { success: false, error: "Update not supported for this resource" };
  }

  const filteredBody: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(validated.data)) {
    if (allowedFields.has(key)) filteredBody[key] = value;
  }
  if (Object.keys(filteredBody).length === 0) {
    return { success: false, error: "No writable fields to update" };
  }

  const updated = await updateRecord(db, {
    resource,
    id,
    body: filteredBody,
    orgId,
  });
  if (!updated) return { success: false, error: "Not found" };

  const entityType = getEntityType(resource);
  const apiKey = resolveStoredApiKey(crmUserRow);
  if (entityType && apiKey) {
    const chunkText = buildEntityText(entityType, updated);
    upsertEntityEmbedding(
      db,
      env.BASICSOS_API_URL,
      apiKey,
      crmUserId,
      entityType,
      id,
      chunkText,
    ).catch(() => {});
  }

  const eventResource = ["deals", "contacts", "tasks"].includes(resource)
    ? resource
    : null;
  if (eventResource) {
    fireEvent(
      `${eventResource.replace(/s$/, "")}.updated`,
      updated,
      crmUserId,
    ).catch(() => {});
  }

  if (resource === "automation_rules") {
    reloadRule(id).catch(() => {});
  }

  return { success: true, record: updated };
}
