import { getQueue, createWorker, QUEUE_NAMES } from "./queue.js";
import { EventBus } from "../events/bus.js";
import {
  db,
  documents,
  documentEmbeddings,
  transcripts,
  meetingEmbeddings,
} from "@basicsos/db";
import { eq } from "drizzle-orm";
import { chunkText } from "../lib/chunker.js";
import { embedTexts } from "../lib/embeddings.js";

type EmbeddingJob = {
  tenantId: string;
  sourceType: "document" | "meeting";
  sourceId: string;
};

export const embeddingQueue = getQueue(QUEUE_NAMES.EMBEDDING);

const extractTextFromContent = (contentJson: unknown): string => {
  if (!contentJson || typeof contentJson !== "object") return "";
  const content = contentJson as {
    content?: Array<{ text?: string; content?: unknown[] }>;
  };
  return content.content?.map((node) => node.text ?? "").join("\n") ?? "";
};

const processDocumentEmbedding = async (
  tenantId: string,
  documentId: string,
): Promise<void> => {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) return;

  const text = doc.title + "\n\n" + extractTextFromContent(doc.contentJson);
  const chunks = chunkText(text, "document");
  const embedded = await embedTexts(chunks.map((c) => c.text));

  await db.delete(documentEmbeddings).where(eq(documentEmbeddings.documentId, documentId));

  if (embedded.length > 0) {
    await db.insert(documentEmbeddings).values(
      embedded.map((e, i) => ({
        tenantId,
        documentId,
        chunkText: e.text,
        embedding: e.embedding,
        chunkIndex: i,
      })),
    );
  }
};

const processTranscriptEmbedding = async (
  tenantId: string,
  meetingId: string,
): Promise<void> => {
  const transcriptRows = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.meetingId, meetingId));
  if (transcriptRows.length === 0) return;

  const transcriptText = transcriptRows
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n");
  const chunks = chunkText(transcriptText, "transcript");
  const embedded = await embedTexts(chunks.map((c) => c.text));

  await db.delete(meetingEmbeddings).where(eq(meetingEmbeddings.meetingId, meetingId));

  if (embedded.length > 0) {
    await db.insert(meetingEmbeddings).values(
      embedded.map((e, i) => ({
        tenantId,
        meetingId,
        chunkText: e.text,
        embedding: e.embedding,
        chunkIndex: i,
        sourceType: "transcript" as const,
      })),
    );
  }
};

export const startEmbeddingWorker = () =>
  createWorker<EmbeddingJob>(QUEUE_NAMES.EMBEDDING, async (job) => {
    const { sourceType, sourceId, tenantId } = job.data;
    if (sourceType === "document") {
      await processDocumentEmbedding(tenantId, sourceId);
    } else {
      await processTranscriptEmbedding(tenantId, sourceId);
    }
    console.warn(`[embedding] Processed ${sourceType}:${sourceId}`);
  });

export const registerEmbeddingListener = (): void => {
  EventBus.on("document.updated", (event) => {
    embeddingQueue
      .add("embed-document", {
        tenantId: event.tenantId,
        sourceType: "document",
        sourceId: event.payload.documentId,
      })
      .catch((err: unknown) => {
        console.error("[embedding] Failed to enqueue document embedding:", err);
      });
  });

  EventBus.on("document.created", (event) => {
    embeddingQueue
      .add("embed-document", {
        tenantId: event.tenantId,
        sourceType: "document",
        sourceId: event.payload.documentId,
      })
      .catch((err: unknown) => {
        console.error("[embedding] Failed to enqueue document embedding:", err);
      });
  });

  EventBus.on("meeting.transcript.finalized", (event) => {
    embeddingQueue
      .add("embed-meeting", {
        tenantId: event.tenantId,
        sourceType: "meeting",
        sourceId: event.payload.meetingId,
      })
      .catch((err: unknown) => {
        console.error("[embedding] Failed to enqueue meeting embedding:", err);
      });
  });
};
