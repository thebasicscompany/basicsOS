import type { Db } from "@/db/client.js";
export declare const EMBEDDABLE_RESOURCES: Set<string>;
export declare function getEntityType(resource: string): string | null;
/**
 * Builds a human-readable text chunk from a CRM record for embedding.
 * The record uses camelCase field names (Drizzle ORM output).
 */
export declare function buildEntityText(entityType: string, record: Record<string, unknown>): string;
/**
 * Generates an embedding for a CRM entity and upserts it into context_embeddings.
 * Safe to call fire-and-forget; all errors are swallowed.
 */
export declare function upsertEntityEmbedding(db: Db, gatewayUrl: string, apiKey: string, crmUserId: number, entityType: string, entityId: number, chunkText: string): Promise<void>;
/**
 * Removes context_embeddings row for a deleted entity.
 */
export declare function deleteEntityEmbedding(db: Db, crmUserId: number, entityType: string, entityId: number): Promise<void>;
//# sourceMappingURL=embeddings.d.ts.map