import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure } from "../trpc.js";
import {
  meetings,
  meetingParticipants,
  transcripts,
  meetingSummaries,
  tasks,
} from "@basicsos/db";
import { EventBus, createEvent } from "../events/bus.js";
import { meetingProcessorQueue } from "../workers/meeting-processor.worker.js";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Transcript parsing helpers
// ---------------------------------------------------------------------------

type TranscriptChunk = {
  speaker: string;
  text: string;
  timestampMs: number;
};

const TIMESTAMP_RE = /^(\d{1,2}):(\d{2}):(\d{2})\s+(.+?):\s*(.+)$/;
const SPEAKER_RE = /^(.+?):\s*(.+)$/;

const parseTimestampMs = (h: string, m: string, s: string): number =>
  (parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10)) * 1000;

const parseLine = (line: string): TranscriptChunk | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const tsMatch = TIMESTAMP_RE.exec(trimmed);
  if (tsMatch) {
    const h = tsMatch[1] ?? "0";
    const m = tsMatch[2] ?? "0";
    const s = tsMatch[3] ?? "0";
    const speaker = tsMatch[4] ?? "";
    const text = tsMatch[5] ?? "";
    return { speaker: speaker.trim(), text: text.trim(), timestampMs: parseTimestampMs(h, m, s) };
  }

  const speakerMatch = SPEAKER_RE.exec(trimmed);
  if (speakerMatch) {
    const speaker = speakerMatch[1] ?? "";
    const text = speakerMatch[2] ?? "";
    return { speaker: speaker.trim(), text: text.trim(), timestampMs: 0 };
  }

  return null;
};

const parseTranscript = (raw: string): TranscriptChunk[] =>
  raw
    .split("\n")
    .map(parseLine)
    .filter((c): c is TranscriptChunk => c !== null);

// ---------------------------------------------------------------------------
// Stub summary type
// ---------------------------------------------------------------------------

type SummaryJson = {
  decisions: string[];
  actionItems: string[];
  followUps: string[];
  note: string;
};

const STUB_SUMMARY: SummaryJson = {
  decisions: [],
  actionItems: [],
  followUps: [],
  note: "Meeting summary pending processing. Configure AI_API_KEY to enable LLM summarization.",
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const meetingsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
      }
      return ctx.db
        .select()
        .from(meetings)
        .where(eq(meetings.tenantId, ctx.tenantId))
        .orderBy(desc(meetings.startedAt))
        .limit(input.limit);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
      }

      const [meeting] = await ctx.db
        .select()
        .from(meetings)
        .where(and(eq(meetings.id, input.id), eq(meetings.tenantId, ctx.tenantId)));

      if (!meeting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      }

      const participants = await ctx.db
        .select()
        .from(meetingParticipants)
        .where(eq(meetingParticipants.meetingId, input.id));

      const transcriptRows = await ctx.db
        .select()
        .from(transcripts)
        .where(eq(transcripts.meetingId, input.id));

      const summaries = await ctx.db
        .select()
        .from(meetingSummaries)
        .where(eq(meetingSummaries.meetingId, input.id));

      return { ...meeting, participants, transcripts: transcriptRows, summaries };
    }),

  create: memberProcedure
    .input(
      z.object({
        title: z.string().min(1).max(512),
        startedAt: z.string().datetime().optional(),
        endedAt: z.string().datetime().optional(),
        participantEmails: z.array(z.string().email()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [meeting] = await ctx.db
        .insert(meetings)
        .values({
          tenantId: ctx.tenantId,
          title: input.title,
          startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
          endedAt: input.endedAt ? new Date(input.endedAt) : undefined,
          createdBy: ctx.userId,
        })
        .returning();

      if (!meeting) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      if (input.participantEmails.length > 0) {
        await ctx.db.insert(meetingParticipants).values(
          input.participantEmails.map((email) => ({
            tenantId: ctx.tenantId,
            meetingId: meeting.id,
            externalEmail: email,
          })),
        );
      }

      EventBus.emit(
        createEvent({
          type: "meeting.started",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { meetingId: meeting.id },
        }),
      );

      return meeting;
    }),

  uploadTranscript: memberProcedure
    .input(
      z.object({
        meetingId: z.string().uuid(),
        transcriptText: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [meeting] = await ctx.db
        .select()
        .from(meetings)
        .where(and(eq(meetings.id, input.meetingId), eq(meetings.tenantId, ctx.tenantId)));

      if (!meeting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      }

      const chunks = parseTranscript(input.transcriptText);

      if (chunks.length > 0) {
        await ctx.db.insert(transcripts).values(
          chunks.map((chunk) => ({
            tenantId: ctx.tenantId,
            meetingId: input.meetingId,
            speaker: chunk.speaker,
            text: chunk.text,
            timestampMs: chunk.timestampMs,
          })),
        );
      }

      EventBus.emit(
        createEvent({
          type: "meeting.transcript.finalized",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { meetingId: input.meetingId },
        }),
      );

      return meeting;
    }),

  process: memberProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [meeting] = await ctx.db
        .select()
        .from(meetings)
        .where(and(eq(meetings.id, input.meetingId), eq(meetings.tenantId, ctx.tenantId)));

      if (!meeting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      }

      // Insert stub summary immediately.
      // The worker will UPDATE this record with real LLM output when AI_API_KEY is configured.
      const [summary] = await ctx.db
        .insert(meetingSummaries)
        .values({
          tenantId: ctx.tenantId,
          meetingId: input.meetingId,
          summaryJson: STUB_SUMMARY,
        })
        .returning();

      if (!summary) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      // Enqueue worker to update the summary with real LLM output.
      // Worker reads the summaryId and UPDATEs the existing row.
      await meetingProcessorQueue.add("process-meeting", {
        tenantId: ctx.tenantId,
        meetingId: input.meetingId,
        summaryId: summary.id,
      }).catch((err: unknown) => {
        // Queue failure is non-fatal — summary already inserted above.
        // Worker can be re-triggered manually if needed.
        console.error("[meetings.process] Failed to enqueue worker job:", err);
      });

      EventBus.emit(
        createEvent({
          type: "meeting.summary.generated",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { meetingId: input.meetingId, summaryId: summary.id },
        }),
      );

      // Action items are extracted by the LLM worker.
      // When the worker runs, it will create tasks linked to this meeting via
      // sourceType='meeting', sourceId=meetingId using the tasks router.

      return summary;
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
      }
      return ctx.db
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.tenantId, ctx.tenantId),
            ilike(meetings.title, `%${input.query.replace(/[%_\\]/g, "\\$&")}%`),
          ),
        );
    }),

  transcribeAudio: memberProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      // Base64-encoded audio chunk (WAV or WebM)
      audioChunk: z.string(),
      format: z.enum(["wav", "webm"]).default("wav"),
    }))
    .mutation(async ({ ctx, input }) => {
      const deepgramKey = process.env["DEEPGRAM_API_KEY"];

      // Without Deepgram: return placeholder
      if (!deepgramKey) {
        return {
          transcript: null,
          message: "Add DEEPGRAM_API_KEY to .env to enable live transcription",
          configured: false,
        };
      }

      try {
        // Decode base64 audio
        const audioBuffer = Buffer.from(input.audioChunk, "base64");

        // Send to Deepgram
        const response = await fetch(
          `https://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&punctuate=true`,
          {
            method: "POST",
            headers: {
              "Authorization": `Token ${deepgramKey}`,
              "Content-Type": `audio/${input.format}`,
            },
            body: audioBuffer,
          },
        );

        if (!response.ok) {
          throw new Error(`Deepgram error: ${response.status}`);
        }

        type DeepgramResult = {
          results?: {
            channels?: Array<{
              alternatives?: Array<{ transcript?: string }>;
            }>;
          };
        };

        const result = await response.json() as DeepgramResult;
        const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

        return { transcript, message: null, configured: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { transcript: null, message, configured: true };
      }
    }),

  /**
   * Returns the most recent transcript chunks for a meeting.
   * Used by the overlay's live Meeting Notes view (polled every 3–5s).
   */
  getTranscript: protectedProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      limit: z.number().int().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Verify the meeting belongs to this tenant
      const [meeting] = await ctx.db
        .select({ id: meetings.id })
        .from(meetings)
        .where(and(eq(meetings.id, input.meetingId), eq(meetings.tenantId, ctx.tenantId)));
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      const chunks = await ctx.db
        .select({ speaker: transcripts.speaker, text: transcripts.text, timestampMs: transcripts.timestampMs })
        .from(transcripts)
        .where(eq(transcripts.meetingId, input.meetingId))
        .orderBy(transcripts.timestampMs)
        .limit(input.limit);

      return chunks;
    }),
});
