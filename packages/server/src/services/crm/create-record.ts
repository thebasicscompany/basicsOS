import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import { buildEntityText, getEntityType, upsertEntityEmbedding } from "@/lib/embeddings.js";
import { fireEvent, reloadRule } from "@/lib/automation-engine.js";
import { resolveStoredApiKey } from "@/lib/api-key-crypto.js";
import { insertRecord } from "@/data-access/crm/create.js";
import { getWriteAllowlist } from "@/routes/crm/handlers/field-allowlists.js";
import { validateWritePayload } from "@/schemas/crm/write-payloads.js";
import type { Resource } from "@/routes/crm/constants.js";

export interface CreateRecordInput {
  resource: Resource;
  body: Record<string, unknown>;
  crmUserId: number;
  orgId: string;
  crmUserRow: Record<string, unknown>;
}

export type CreateRecordResult =
  | { success: true; record: Record<string, unknown> }
  | { success: false; error: string };

export async function createRecord(
  db: Db,
  env: Env,
  input: CreateRecordInput,
): Promise<CreateRecordResult> {
  const { resource, body, crmUserId, orgId, crmUserRow } = input;

  const validated = validateWritePayload(resource, "create", body);
  if (!validated.success) return { success: false, error: validated.error };

  const allowedFields = getWriteAllowlist(resource);
  if (allowedFields.size === 0) {
    return { success: false, error: "Create not supported for this resource" };
  }

  const filteredBody: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(validated.data)) {
    if (allowedFields.has(key)) filteredBody[key] = value;
  }
  if (Object.keys(filteredBody).length === 0) {
    return { success: false, error: "No writable fields provided" };
  }

  const inserted = await insertRecord(db, {
    resource,
    body: filteredBody,
    crmUserId,
    orgId,
  });
  if (!inserted) return { success: false, error: "Insert failed" };

  const entityType = getEntityType(resource);
  const apiKey = resolveStoredApiKey(crmUserRow);
  const insertedId = (inserted as { id?: number }).id;
  if (entityType && apiKey && insertedId != null && typeof insertedId === "number") {
    const chunkText = buildEntityText(entityType, inserted);
    upsertEntityEmbedding(
      db,
      env.BASICSOS_API_URL,
      apiKey,
      crmUserId,
      entityType,
      insertedId,
      chunkText,
    ).catch(() => {});
  }

  const eventResource = ["deals", "contacts", "tasks"].includes(resource)
    ? resource
    : null;
  if (eventResource) {
    fireEvent(
      `${eventResource.replace(/s$/, "")}.created`,
      inserted,
      crmUserId,
    ).catch(() => {});
  }

  if (
    resource === "automation_rules" &&
    insertedId != null &&
    typeof insertedId === "number"
  ) {
    reloadRule(insertedId).catch(() => {});
  }

  return { success: true, record: inserted };
}
