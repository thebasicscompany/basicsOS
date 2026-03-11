import type { Db } from "@/db/client.js";
/**
 * Builds a brief CRM state summary injected into every AI request.
 * Uses aggregate queries — never loads full records.
 */
export declare function buildCrmSummary(db: Db, organizationId: string): Promise<string>;
export interface RetrievalStrategy {
    crmLimit: number;
    meetingLimit: number;
}
/**
 * Keyword-based heuristic to determine how many retrieval slots
 * to allocate to CRM records vs meeting transcripts.
 */
export declare function classifyQueryIntent(query: string): RetrievalStrategy;
/**
 * Embeds the query via the gateway and returns the vector + usage info.
 * Returns null embedding on failure.
 */
export declare function embedQuery(gatewayUrl: string, gatewayHeaders: Record<string, string>, query: string): Promise<{
    embedding: number[] | null;
    inputTokens: number;
}>;
/**
 * Runs a pgvector similarity search with a pre-computed embedding vector.
 * Optionally filters by entity_type.
 */
export declare function searchEmbeddings(db: Db, organizationId: string, embeddingVec: number[], limit: number, entityTypeFilter?: string[]): Promise<string | null>;
/**
 * Embeds the query and runs a pgvector similarity search against context_embeddings.
 * Returns formatted top-K results, or null if unavailable/empty.
 * Backward-compatible — existing callers work without changes.
 */
export declare function retrieveRelevantContext(db: Db, gatewayUrl: string, gatewayHeaders: Record<string, string>, organizationId: string, query: string, limit?: number, crmUserId?: number): Promise<string | null>;
/**
 * Dual retrieval: embeds query once, then searches CRM and meeting embeddings
 * separately with limits determined by query intent classification.
 * Returns { crmContext, meetingContext } — each may be null.
 */
export declare function retrieveDualContext(db: Db, gatewayUrl: string, gatewayHeaders: Record<string, string>, organizationId: string, query: string, crmUserId?: number): Promise<{
    crmContext: string | null;
    meetingContext: string | null;
}>;
//# sourceMappingURL=context.d.ts.map