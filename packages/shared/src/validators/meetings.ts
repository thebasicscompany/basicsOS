import { z } from "zod";

export const insertMeetingSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string().min(1).max(512),
  startedAt: z.date().optional(),
  endedAt: z.date().optional(),
  calendarEventId: z.string().optional(),
  createdBy: z.string().uuid(),
});

export const insertTranscriptSchema = z.object({
  meetingId: z.string().uuid(),
  speaker: z.string().min(1),
  text: z.string().min(1),
  timestampMs: z.number().int().min(0).default(0),
});

export const uploadTranscriptSchema = z.object({
  meetingId: z.string().uuid(),
  transcriptText: z.string().min(1),
});

export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type UploadTranscript = z.infer<typeof uploadTranscriptSchema>;
