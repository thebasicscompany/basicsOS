import { describe, it, expect } from "vitest";
import { insertMeetingSchema, insertTranscriptSchema, uploadTranscriptSchema } from "./meetings.js";

const VALID_UUID = "00000000-0000-0000-0000-000000000001";
const VALID_UUID_2 = "00000000-0000-0000-0000-000000000002";

describe("insertMeetingSchema", () => {
  const validInput = {
    tenantId: VALID_UUID,
    title: "Weekly Standup",
    createdBy: VALID_UUID_2,
  };

  it("accepts minimal valid input", () => {
    expect(insertMeetingSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts optional startedAt and endedAt", () => {
    const result = insertMeetingSchema.safeParse({
      ...validInput,
      startedAt: new Date("2025-01-01T10:00:00Z"),
      endedAt: new Date("2025-01-01T10:30:00Z"),
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional calendarEventId", () => {
    const result = insertMeetingSchema.safeParse({
      ...validInput,
      calendarEventId: "cal-event-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const { title, ...rest } = validInput;
    expect(insertMeetingSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty title", () => {
    expect(insertMeetingSchema.safeParse({ ...validInput, title: "" }).success).toBe(false);
  });

  it("rejects title over 512 characters", () => {
    expect(insertMeetingSchema.safeParse({ ...validInput, title: "a".repeat(513) }).success).toBe(
      false,
    );
  });

  it("rejects invalid tenantId", () => {
    expect(insertMeetingSchema.safeParse({ ...validInput, tenantId: "not-uuid" }).success).toBe(
      false,
    );
  });

  it("rejects invalid createdBy", () => {
    expect(insertMeetingSchema.safeParse({ ...validInput, createdBy: "bad" }).success).toBe(false);
  });
});

describe("insertTranscriptSchema", () => {
  const validInput = {
    meetingId: VALID_UUID,
    speaker: "Alice",
    text: "Let's review the sprint goals.",
  };

  it("accepts valid input", () => {
    expect(insertTranscriptSchema.safeParse(validInput).success).toBe(true);
  });

  it("defaults timestampMs to 0", () => {
    const result = insertTranscriptSchema.safeParse(validInput);
    if (result.success) expect(result.data.timestampMs).toBe(0);
  });

  it("accepts custom timestampMs", () => {
    const result = insertTranscriptSchema.safeParse({ ...validInput, timestampMs: 5000 });
    expect(result.success).toBe(true);
  });

  it("rejects missing speaker", () => {
    const { speaker, ...rest } = validInput;
    expect(insertTranscriptSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty speaker", () => {
    expect(insertTranscriptSchema.safeParse({ ...validInput, speaker: "" }).success).toBe(false);
  });

  it("rejects empty text", () => {
    expect(insertTranscriptSchema.safeParse({ ...validInput, text: "" }).success).toBe(false);
  });

  it("rejects invalid meetingId", () => {
    expect(insertTranscriptSchema.safeParse({ ...validInput, meetingId: "bad" }).success).toBe(
      false,
    );
  });

  it("rejects negative timestampMs", () => {
    expect(insertTranscriptSchema.safeParse({ ...validInput, timestampMs: -1 }).success).toBe(
      false,
    );
  });
});

describe("uploadTranscriptSchema", () => {
  it("accepts valid input", () => {
    const result = uploadTranscriptSchema.safeParse({
      meetingId: VALID_UUID,
      transcriptText: "Alice: Hello\nBob: Hi there",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty transcriptText", () => {
    expect(
      uploadTranscriptSchema.safeParse({ meetingId: VALID_UUID, transcriptText: "" }).success,
    ).toBe(false);
  });

  it("rejects invalid meetingId", () => {
    expect(
      uploadTranscriptSchema.safeParse({ meetingId: "bad", transcriptText: "text" }).success,
    ).toBe(false);
  });

  it("rejects missing meetingId", () => {
    expect(uploadTranscriptSchema.safeParse({ transcriptText: "text" }).success).toBe(false);
  });
});
