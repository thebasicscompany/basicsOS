import type { Db } from "../db/client.js";
/**
 * Builds a brief CRM state summary injected into every AI request.
 * Uses aggregate queries — never loads full records.
 */
export declare function buildCrmSummary(db: Db, organizationId: string): Promise<string>;
/**
 * Embeds the query and runs a pgvector similarity search against context_embeddings.
 * Returns formatted top-K results, or null if unavailable/empty.
 */
export declare function retrieveRelevantContext(db: Db, gatewayUrl: string, apiKey: string, organizationId: string, query: string, limit?: number): Promise<string | null>;
//# sourceMappingURL=context.d.ts.map