import { and, eq, sql } from "drizzle-orm";
import * as schema from "../db/schema/index.js";
import { writeUsageLogSafe } from "../lib/usage-log.js";
export const EMBEDDABLE_RESOURCES = new Set([
    "contacts",
    "companies",
    "deals",
    "tasks",
    "contact_notes",
    "deal_notes",
    "meeting_chunks",
    "meeting_summaries",
]);
// Maps CRM resource name to entity_type stored in context_embeddings.
const ENTITY_TYPE_MAP = {
    contacts: "contact",
    companies: "company",
    deals: "deal",
    tasks: "task",
    contact_notes: "contact_note",
    deal_notes: "deal_note",
    meeting_chunks: "meeting_chunk",
    meeting_summaries: "meeting_summary",
};
export function getEntityType(resource) {
    return ENTITY_TYPE_MAP[resource] ?? null;
}
/**
 * Builds a human-readable text chunk from a CRM record for embedding.
 * The record uses camelCase field names (Drizzle ORM output).
 */
export function buildEntityText(entityType, record) {
    switch (entityType) {
        case "contact": {
            const parts = [
                [record.firstName, record.lastName].filter(Boolean).join(" "),
                record.email ? `Email: ${record.email}` : null,
            ].filter(Boolean);
            return parts.join(". ");
        }
        case "company": {
            const parts = [
                record.name,
                record.category ? `Category: ${record.category}` : null,
                record.domain ? `Domain: ${record.domain}` : null,
                record.description ? `Description: ${record.description}` : null,
            ].filter(Boolean);
            return parts.join(". ");
        }
        case "deal": {
            const parts = [
                record.name,
                record.status ? `Status: ${record.status}` : null,
                record.amount ? `Value: $${record.amount}` : null,
            ].filter(Boolean);
            return parts.join(". ");
        }
        case "task": {
            const parts = [
                record.text ? String(record.text).trim() : null,
                record.description ? String(record.description).trim() : null,
                record.type ? `Type: ${record.type}` : null,
            ].filter(Boolean);
            return parts.join(". ");
        }
        case "contact_note":
        case "deal_note":
            return String(record.text ?? "").trim();
        default:
            return "";
    }
}
async function generateEmbedding(gatewayUrl, apiKey, text) {
    try {
        const res = await fetch(`${gatewayUrl}/v1/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model: "basics-embed", input: text }),
        });
        if (!res.ok)
            return { embedding: null, inputTokens: 0 };
        const json = (await res.json());
        const fromApi = json.usage?.prompt_tokens ?? json.usage?.total_tokens ?? 0;
        // Gateway often returns 0 for embeddings; estimate from text when so (≈4 chars/token)
        const inputTokens = fromApi > 0 ? fromApi : Math.max(1, Math.ceil(text.length / 4));
        return {
            embedding: json.data?.[0]?.embedding ?? null,
            inputTokens,
        };
    }
    catch {
        return { embedding: null, inputTokens: 0 };
    }
}
/**
 * Generates an embedding for a CRM entity and upserts it into context_embeddings.
 * Safe to call fire-and-forget; all errors are swallowed.
 */
export async function upsertEntityEmbedding(db, gatewayUrl, apiKey, crmUserId, entityType, entityId, chunkText) {
    if (!chunkText.trim())
        return;
    const { embedding, inputTokens } = await generateEmbedding(gatewayUrl, apiKey, chunkText);
    if (!embedding)
        return;
    const [crmUser] = await db
        .select({ organizationId: schema.crmUsers.organizationId })
        .from(schema.crmUsers)
        .where(eq(schema.crmUsers.id, crmUserId))
        .limit(1);
    if (!crmUser?.organizationId)
        return;
    writeUsageLogSafe(db, {
        organizationId: crmUser.organizationId,
        crmUserId,
        feature: "embedding_record",
        model: "basics-embed",
        inputTokens,
    });
    const embeddingStr = `[${embedding.join(",")}]`;
    await db.execute(sql `
    INSERT INTO context_embeddings (crm_user_id, organization_id, entity_type, entity_id, chunk_text, embedding, updated_at)
    VALUES (
      ${crmUserId},
      ${crmUser.organizationId},
      ${entityType},
      ${entityId},
      ${chunkText},
      ${embeddingStr}::vector,
      now()
    )
    ON CONFLICT (crm_user_id, entity_type, entity_id)
    DO UPDATE SET
      chunk_text = EXCLUDED.chunk_text,
      organization_id = EXCLUDED.organization_id,
      embedding = EXCLUDED.embedding,
      updated_at = now()
  `);
}
/**
 * Removes context_embeddings row for a deleted entity.
 */
export async function deleteEntityEmbedding(db, crmUserId, entityType, entityId) {
    await db
        .delete(schema.contextEmbeddings)
        .where(and(eq(schema.contextEmbeddings.crmUserId, crmUserId), eq(schema.contextEmbeddings.entityType, entityType), eq(schema.contextEmbeddings.entityId, entityId)));
}
