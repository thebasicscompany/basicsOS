import { createWorker, getQueue, QUEUE_NAMES } from "./queue.js";
import { EventBus, createEvent } from "../events/bus.js";
import { db, transcripts, meetingSummaries } from "@basicsos/db";
import { eq } from "drizzle-orm";

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
  note: "Processing stub - LLM integration in Task 21",
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

  // Phase 1: Use stub summary. Task 21 will replace with real LLM output.
  // If a summaryId was provided by the router, UPDATE the existing row.
  // Otherwise INSERT a new row (for auto-triggered jobs via transcript.finalized).
  let resolvedSummaryId: string;

  if (summaryId) {
    await db
      .update(meetingSummaries)
      .set({ summaryJson: STUB_SUMMARY })
      .where(eq(meetingSummaries.id, summaryId));
    resolvedSummaryId = summaryId;
  } else {
    const [inserted] = await db
      .insert(meetingSummaries)
      .values({ tenantId, meetingId, summaryJson: STUB_SUMMARY })
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
};

export const startMeetingProcessorWorker = () =>
  createWorker<MeetingProcessorJob>(QUEUE_NAMES.MEETING_PROCESSOR, processJob);

export const registerMeetingProcessorListener = (): void => {
  EventBus.on("meeting.transcript.finalized", (event) => {
    meetingProcessorQueue.add("process-meeting", {
      tenantId: event.tenantId,
      meetingId: event.payload.meetingId,
    }).catch((err) => {
      console.error("[meeting-processor] Failed to enqueue job:", err);
    });
  });
};
