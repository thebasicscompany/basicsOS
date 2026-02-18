# Meeting Intelligence Module

## Overview
The Meeting Intelligence module captures, processes, and surfaces insights from meetings. It provides transcript ingestion, async summarization via a BullMQ worker, and structured output (decisions, action items, follow-ups).

## Core Tables (packages/db/src/schema/meetings.ts)
- `meetings` — top-level meeting record with title, start/end timestamps, and tenant ownership
- `meeting_participants` — users or external emails attending a meeting
- `transcripts` — individual speaker turns parsed from uploaded transcript text
- `meeting_summaries` — JSON blob of decisions, action items, and follow-ups derived from transcripts
- `meeting_embeddings` — vector embeddings of transcript/summary chunks for semantic search (Task 21+)

## tRPC Router (packages/api/src/routers/meetings.ts)
| Procedure | Auth | Description |
|---|---|---|
| `meetings.list` | protectedProcedure | List meetings for tenant, newest first |
| `meetings.get` | protectedProcedure | Get meeting with participants, transcripts, and summaries |
| `meetings.create` | memberProcedure | Create a meeting; optionally seed participant emails |
| `meetings.uploadTranscript` | memberProcedure | Parse and insert transcript lines; emits `meeting.transcript.finalized` |
| `meetings.process` | memberProcedure | Enqueue meeting processor job; inserts stub summary; emits `meeting.summary.generated` |
| `meetings.search` | protectedProcedure | Full-text ilike search on meeting title |

## Transcript Parsing
Input format supports two styles:
- `Speaker Name: text` — plain speaker-colon-text lines
- `00:01:23 Speaker: text` — timestamped lines with HH:MM:SS prefix

## Async Processing (packages/api/src/workers/meeting-processor.worker.ts)
The `meeting-processor` BullMQ worker:
1. Fetches transcript rows for the meeting
2. Inserts a stub `meeting_summaries` row (LLM summarization deferred to Task 21)
3. Emits `meeting.summary.generated`

The worker is also auto-triggered by listening to `meeting.transcript.finalized` events via `registerMeetingProcessorListener`.

## Events
| Event | Trigger |
|---|---|
| `meeting.started` | After `meetings.create` |
| `meeting.transcript.finalized` | After `meetings.uploadTranscript` |
| `meeting.summary.generated` | After `meetings.process` or worker completion |

## Validators (packages/shared/src/validators/meetings.ts)
- `insertMeetingSchema` — full DB insert shape including tenantId/createdBy
- `insertTranscriptSchema` — single transcript row
- `uploadTranscriptSchema` — raw text upload payload `{ meetingId, transcriptText }`
