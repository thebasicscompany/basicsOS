import { db, documentEmbeddings, meetingEmbeddings } from "@basicsos/db";
import { sql } from "drizzle-orm";
import { embedTexts } from "./embeddings.js";

export type SearchResult = {
  sourceType: "document" | "meeting";
  sourceId: string;
  chunkText: string;
  score: number;
};

type DocRow = { documentSourceId: string; chunkText: string; score: number };
type MeetingRow = { meetingSourceId: string; chunkText: string; score: number };

const queryDocumentEmbeddings = async (
  embeddingLiteral: string,
  tenantId: string,
  limit: number,
): Promise<SearchResult[]> => {
  const result = await db.execute(sql`
    SELECT
      document_id as "documentSourceId",
      chunk_text as "chunkText",
      1 - (embedding <=> ${embeddingLiteral}::vector) as score
    FROM document_embeddings
    WHERE tenant_id = ${tenantId}
    ORDER BY embedding <=> ${embeddingLiteral}::vector
    LIMIT ${limit}
  `);
  return (result.rows as DocRow[]).map((r) => ({
    sourceType: "document" as const,
    sourceId: r.documentSourceId,
    chunkText: r.chunkText,
    score: r.score,
  }));
};

const queryMeetingEmbeddings = async (
  embeddingLiteral: string,
  tenantId: string,
  limit: number,
): Promise<SearchResult[]> => {
  const result = await db.execute(sql`
    SELECT
      meeting_id as "meetingSourceId",
      chunk_text as "chunkText",
      1 - (embedding <=> ${embeddingLiteral}::vector) as score
    FROM meeting_embeddings
    WHERE tenant_id = ${tenantId}
    ORDER BY embedding <=> ${embeddingLiteral}::vector
    LIMIT ${limit}
  `);
  return (result.rows as MeetingRow[]).map((r) => ({
    sourceType: "meeting" as const,
    sourceId: r.meetingSourceId,
    chunkText: r.chunkText,
    score: r.score,
  }));
};

export const semanticSearch = async (
  query: string,
  tenantId: string,
  limit = 10,
): Promise<SearchResult[]> => {
  const [embedded] = await embedTexts([query]);
  if (!embedded) return [];

  const embeddingLiteral = `[${embedded.embedding.join(",")}]`;

  const [docResults, meetingResults] = await Promise.all([
    queryDocumentEmbeddings(embeddingLiteral, tenantId, limit),
    queryMeetingEmbeddings(embeddingLiteral, tenantId, limit),
  ]);

  // Suppress unused import warning — tables are referenced for type safety
  void documentEmbeddings;
  void meetingEmbeddings;

  return [...docResults, ...meetingResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};
