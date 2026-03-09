import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import * as schema from "@/db/schema/index.js";
import { upsertEntityEmbedding } from "@/lib/embeddings.js";
import { decryptApiKey } from "@/lib/api-key-crypto.js";

const TARGET_CHUNK_CHARS = 600;
const MAX_SINGLE_TURN_CHARS = 800;

interface TranscriptSegment {
  id: number;
  speaker: string | null;
  text: string | null;
}

interface Chunk {
  entityId: number;
  chunkText: string;
}

/**
 * Groups consecutive transcript segments into chunks of ~600 chars.
 * Never splits mid-turn; single turns > 800 chars become their own chunk.
 * Each chunk is prefixed with meeting metadata.
 */
export function chunkMeetingTranscript(
  title: string | null,
  date: Date | null,
  segments: TranscriptSegment[],
): Chunk[] {
  if (segments.length === 0) return [];

  const dateStr = date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown date";
  const header = `Meeting: "${title ?? "Untitled Meeting"}" (${dateStr})\n---\n`;

  const chunks: Chunk[] = [];
  let currentLines: string[] = [];
  let currentChars = 0;
  let firstSegmentId = segments[0].id;

  for (const seg of segments) {
    const line = seg.speaker ? `${seg.speaker}: ${seg.text ?? ""}` : (seg.text ?? "");
    const lineLen = line.length;

    // Single turn exceeds max — flush current, then emit this turn as its own chunk
    if (lineLen > MAX_SINGLE_TURN_CHARS) {
      if (currentLines.length > 0) {
        chunks.push({
          entityId: firstSegmentId,
          chunkText: header + currentLines.join("\n"),
        });
        currentLines = [];
        currentChars = 0;
      }
      chunks.push({
        entityId: seg.id,
        chunkText: header + line,
      });
      firstSegmentId = seg.id;
      continue;
    }

    // Adding this line would exceed target — flush current chunk
    if (currentChars + lineLen > TARGET_CHUNK_CHARS && currentLines.length > 0) {
      chunks.push({
        entityId: firstSegmentId,
        chunkText: header + currentLines.join("\n"),
      });
      currentLines = [];
      currentChars = 0;
      firstSegmentId = seg.id;
    }

    if (currentLines.length === 0) {
      firstSegmentId = seg.id;
    }
    currentLines.push(line);
    currentChars += lineLen + 1; // +1 for newline
  }

  // Flush remaining
  if (currentLines.length > 0) {
    chunks.push({
      entityId: firstSegmentId,
      chunkText: header + currentLines.join("\n"),
    });
  }

  return chunks;
}

/**
 * Embeds a meeting's transcript chunks and summary into context_embeddings.
 * Fire-and-forget — all errors are swallowed.
 */
export async function embedMeetingTranscript(
  db: Db,
  env: Env,
  crmUser: { id: number; organizationId: string | null },
  meetingId: number,
): Promise<void> {
  try {
    if (!crmUser.organizationId) return;

    // Resolve API key for embedding (same pattern as create-record.ts)
    const [aiConfig] = await db
      .select()
      .from(schema.orgAiConfig)
      .where(eq(schema.orgAiConfig.organizationId, crmUser.organizationId))
      .limit(1);
    let apiKey: string | null = null;
    if (aiConfig?.apiKeyEnc) {
      apiKey = decryptApiKey(aiConfig.apiKeyEnc);
    }
    if (!apiKey) {
      apiKey = env.SERVER_BASICS_API_KEY ?? env.SERVER_BYOK_API_KEY ?? null;
    }
    if (!apiKey) return;

    const gatewayUrl = env.BASICSOS_API_URL;

    // Fetch meeting + transcripts + summary
    const [meeting] = await db
      .select()
      .from(schema.meetings)
      .where(eq(schema.meetings.id, meetingId))
      .limit(1);
    if (!meeting) return;

    const transcripts = await db
      .select({
        id: schema.meetingTranscripts.id,
        speaker: schema.meetingTranscripts.speaker,
        text: schema.meetingTranscripts.text,
      })
      .from(schema.meetingTranscripts)
      .where(eq(schema.meetingTranscripts.meetingId, meetingId))
      .orderBy(schema.meetingTranscripts.timestampMs);

    // Chunk transcript segments
    const chunks = chunkMeetingTranscript(
      meeting.title,
      meeting.startedAt,
      transcripts,
    );

    // Embed each chunk (fire-and-forget per chunk)
    for (const chunk of chunks) {
      upsertEntityEmbedding(
        db,
        gatewayUrl,
        apiKey,
        crmUser.id,
        "meeting_chunk",
        chunk.entityId,
        chunk.chunkText,
      ).catch(() => {});
    }

    // Also embed the summary if it exists
    const [summary] = await db
      .select()
      .from(schema.meetingSummaries)
      .where(eq(schema.meetingSummaries.meetingId, meetingId))
      .limit(1);

    if (summary?.summaryJson) {
      const sj = summary.summaryJson as { title?: string; note?: string };
      const dateStr = meeting.startedAt
        ? meeting.startedAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Unknown date";
      const summaryText = [
        `Meeting Summary: "${meeting.title ?? "Untitled Meeting"}" (${dateStr})`,
        sj.note ?? "",
      ]
        .filter(Boolean)
        .join("\n");

      if (summaryText.trim()) {
        upsertEntityEmbedding(
          db,
          gatewayUrl,
          apiKey,
          crmUser.id,
          "meeting_summary",
          summary.id,
          summaryText,
        ).catch(() => {});
      }
    }

    console.warn(
      `[embedding_record] meeting_chunk: embedded ${chunks.length} chunks for meeting ${meetingId}`,
    );
  } catch (err) {
    console.error("[meeting-embeddings] embedMeetingTranscript failed:", err);
  }
}

/**
 * Deletes all context_embeddings rows for a meeting's transcript chunks and summary.
 * Must be called BEFORE the meeting is deleted (FK cascade removes transcript rows).
 */
export async function deleteMeetingEmbeddings(
  db: Db,
  organizationId: string,
  meetingId: number,
): Promise<void> {
  try {
    // Get transcript segment IDs
    const transcriptRows = await db
      .select({ id: schema.meetingTranscripts.id })
      .from(schema.meetingTranscripts)
      .where(eq(schema.meetingTranscripts.meetingId, meetingId));

    // Get summary ID
    const summaryRows = await db
      .select({ id: schema.meetingSummaries.id })
      .from(schema.meetingSummaries)
      .where(eq(schema.meetingSummaries.meetingId, meetingId));

    const entityIds = [
      ...transcriptRows.map((r) => r.id),
      ...summaryRows.map((r) => r.id),
    ];

    if (entityIds.length === 0) return;

    // Delete all matching embeddings
    await db.execute(sql`
      DELETE FROM context_embeddings
      WHERE organization_id = ${organizationId}
        AND entity_type IN ('meeting_chunk', 'meeting_summary')
        AND entity_id = ANY(${entityIds}::bigint[])
    `);
  } catch (err) {
    console.error("[meeting-embeddings] deleteMeetingEmbeddings failed:", err);
  }
}
