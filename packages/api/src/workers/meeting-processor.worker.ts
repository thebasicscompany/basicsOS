import { createWorker, getQueue, QUEUE_NAMES } from "./queue.js";
import { EventBus, createEvent } from "../events/bus.js";
import { db, transcripts, meetingSummaries, meetings } from "@basicsos/db";
import { eq } from "drizzle-orm";
import { chatCompletion } from "../lib/llm-client.js";
import { sendNotification } from "./notification.worker.js";

type MeetingProcessorJob = {
  tenantId: string;
  meetingId: string;
  summaryId?: string; // If provided, UPDATE the existing stub (Phase 1 pattern)
};

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

const buildTranscriptText = (
  rows: Array<{ speaker: string; text: string; timestampMs: number }>,
): string =>
  rows
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .map((r) => `${r.speaker}: ${r.text}`)
    .join("\n");

const generateSummary = async (transcriptText: string, meetingId: string): Promise<SummaryJson> => {
  const apiKey = process.env["AI_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return STUB_SUMMARY;

  const systemPrompt = `You are a meeting intelligence assistant. Analyze the meeting transcript and extract structured information.
Return ONLY a valid JSON object with these exact keys:
- decisions: string[] — key decisions made during the meeting
- actionItems: string[] — specific tasks assigned or committed to, with owner if mentioned
- followUps: string[] — topics that need follow-up or future discussion
- note: string — a 2-3 sentence executive summary of the meeting

Keep each item concise (under 100 characters). Return empty arrays if nothing applies.`;

  const userPrompt = `Analyze this meeting transcript and return structured JSON:\n\n${transcriptText}`;

  try {
    const response = await chatCompletion(
      {
        messages: [{ role: "user", content: userPrompt }],
        model: "claude-haiku-4-5-20251001", // Use fast model for summarization
      },
      { featureName: "meeting.summary" },
    );

    // Strip markdown code fences if present
    const raw = response.content
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();

    const parsed = JSON.parse(raw) as Partial<SummaryJson>;
    return {
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
      note: typeof parsed.note === "string" ? parsed.note : "Meeting processed.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[meeting-processor] LLM summary generation failed for meeting:${meetingId}:`,
      message,
    );
    return {
      ...STUB_SUMMARY,
      note: `LLM processing failed: ${message}. Raw transcript is available.`,
    };
  }
};

export const meetingProcessorQueue = getQueue(QUEUE_NAMES.MEETING_PROCESSOR);

const processJob = async (job: { data: MeetingProcessorJob }): Promise<void> => {
  const { meetingId, tenantId, summaryId } = job.data;

  const transcriptRows = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.meetingId, meetingId));

  console.warn(
    `[meeting-processor] Processing meeting:${meetingId} for tenant:${tenantId} ` +
      `with ${transcriptRows.length} transcript rows`,
  );

  // Generate AI summary if transcript rows exist; fall back to stub otherwise.
  const summaryJson: SummaryJson =
    transcriptRows.length > 0
      ? await generateSummary(buildTranscriptText(transcriptRows), meetingId)
      : STUB_SUMMARY;

  let resolvedSummaryId: string;

  if (summaryId) {
    await db
      .update(meetingSummaries)
      .set({ summaryJson })
      .where(eq(meetingSummaries.id, summaryId));
    resolvedSummaryId = summaryId;
  } else {
    const [inserted] = await db
      .insert(meetingSummaries)
      .values({ tenantId, meetingId, summaryJson })
      .returning();

    if (!inserted) {
      console.error(`[meeting-processor] Failed to insert summary for meeting:${meetingId}`);
      return;
    }
    resolvedSummaryId = inserted.id;
  }

  EventBus.emit(
    createEvent({
      type: "meeting.summary.generated",
      tenantId,
      payload: { meetingId, summaryId: resolvedSummaryId },
    }),
  );

  // Notify the meeting creator via push notification
  const [meetingRow] = await db
    .select({ createdBy: meetings.createdBy, title: meetings.title })
    .from(meetings)
    .where(eq(meetings.id, meetingId));

  if (meetingRow?.createdBy) {
    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
    sendNotification({
      tenantId,
      userId: meetingRow.createdBy,
      type: "meeting.summary.ready",
      title: "Meeting summary ready",
      body: `Summary for "${meetingRow.title}" is ready to review.`,
      actionUrl: `${appUrl}/meetings/${meetingId}`,
    });
  }
};

export const startMeetingProcessorWorker = () =>
  createWorker<MeetingProcessorJob>(QUEUE_NAMES.MEETING_PROCESSOR, processJob);

export const registerMeetingProcessorListener = (): void => {
  EventBus.on("meeting.transcript.finalized", (event) => {
    meetingProcessorQueue
      .add("process-meeting", {
        tenantId: event.tenantId,
        meetingId: event.payload.meetingId,
      })
      .catch((err) => {
        console.error("[meeting-processor] Failed to enqueue job:", err);
      });
  });
};
