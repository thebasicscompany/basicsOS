import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "../context.js";
import { EventBus } from "../events/bus.js";

// ---------------------------------------------------------------------------
// Mock @basicsos/db so no real DB connection is required
// ---------------------------------------------------------------------------
vi.mock("@basicsos/db", () => {
  const meetings = {
    id: "id",
    tenantId: "tenantId",
    title: "title",
    startedAt: "startedAt",
    endedAt: "endedAt",
    createdBy: "createdBy",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  };
  const meetingParticipants = {
    id: "id",
    tenantId: "tenantId",
    meetingId: "meetingId",
    externalEmail: "externalEmail",
  };
  const transcripts = {
    id: "id",
    tenantId: "tenantId",
    meetingId: "meetingId",
    speaker: "speaker",
    text: "text",
    timestampMs: "timestampMs",
  };
  const meetingSummaries = {
    id: "id",
    tenantId: "tenantId",
    meetingId: "meetingId",
    summaryJson: "summaryJson",
    createdAt: "createdAt",
  };
  const tasks = {
    id: "id",
    tenantId: "tenantId",
    title: "title",
    createdBy: "createdBy",
    sourceType: "sourceType",
    sourceId: "sourceId",
  };
  return {
    meetings,
    meetingParticipants,
    transcripts,
    meetingSummaries,
    tasks,
    db: {},
    users: { id: "id", name: "name", email: "email", role: "role", tenantId: "tenantId", onboardedAt: "onboardedAt", createdAt: "createdAt" },
    sessions: { id: "id", userId: "userId", token: "token", expiresAt: "expiresAt" },
    accounts: { id: "id", userId: "userId", providerId: "providerId", accountId: "accountId" },
    verifications: { id: "id", identifier: "identifier", value: "value", expiresAt: "expiresAt" },
    tenants: { id: "id", name: "name", slug: "slug", createdAt: "createdAt" },
    invites: { id: "id", tenantId: "tenantId", email: "email", role: "role", token: "token", acceptedAt: "acceptedAt", expiresAt: "expiresAt", createdAt: "createdAt" },
  };
});

// Mock the worker so BullMQ / Redis is not required
vi.mock("../workers/meeting-processor.worker.js", () => ({
  meetingProcessorQueue: {
    add: vi.fn().mockResolvedValue(undefined),
  },
}));

// After mocking, import the router under test
import { meetingsRouter } from "./meetings.js";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const MEETING_ID = "00000000-0000-0000-0000-000000000003";

// ---------------------------------------------------------------------------
// Thenable chain factory  (mirrors tasks.test.ts pattern)
// ---------------------------------------------------------------------------
const makeChain = (rows: unknown[]) => {
  const promise = Promise.resolve(rows);
  const chain: Record<string, unknown> = {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  for (const method of ["from", "where", "set", "values", "orderBy", "returning", "limit"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  return chain;
};

// ---------------------------------------------------------------------------
// DB mock builder
// ---------------------------------------------------------------------------
const makeMockDb = (
  opts: {
    selectRows?: unknown[];
    insertRows?: unknown[];
    updateRows?: unknown[];
    deleteRows?: unknown[];
    selectSequence?: unknown[][];
  } = {},
) => {
  const insertRows = opts.insertRows ?? [];
  const updateRows = opts.updateRows ?? [];
  const deleteRows = opts.deleteRows ?? [];
  const selectSequence = opts.selectSequence;
  const defaultSelectRows = opts.selectRows ?? [];
  let selectCallCount = 0;

  const db = {
    select: vi.fn().mockImplementation(() => {
      const rows = selectSequence ? (selectSequence[selectCallCount++] ?? []) : defaultSelectRows;
      return makeChain(rows);
    }),
    insert: vi.fn().mockReturnValue(makeChain(insertRows)),
    update: vi.fn().mockReturnValue(makeChain(updateRows)),
    delete: vi.fn().mockReturnValue(makeChain(deleteRows)),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(),
  };

  db.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));

  return db;
};

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------
const buildCtx = (overrides: Partial<TRPCContext> = {}): TRPCContext => ({
  db: {} as TRPCContext["db"],
  userId: USER_ID,
  tenantId: TENANT_ID,
  role: "member",
  sessionId: "session-1",
  headers: new Headers(),
  ...overrides,
});

const makeMeeting = (overrides: Record<string, unknown> = {}) => ({
  id: MEETING_ID,
  tenantId: TENANT_ID,
  title: "Sprint Planning",
  startedAt: new Date("2024-01-10T09:00:00Z"),
  endedAt: null,
  calendarEventId: null,
  createdBy: USER_ID,
  createdAt: new Date("2024-01-10"),
  updatedAt: new Date("2024-01-10"),
  ...overrides,
});

const caller = (ctx: TRPCContext) => meetingsRouter.createCaller(ctx);

beforeEach(() => {
  EventBus.removeAllListeners();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// meetings.list
// ---------------------------------------------------------------------------
describe("meetings.list", () => {
  it("returns empty array when tenant has no meetings", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).list({});
    expect(result).toEqual([]);
  });

  it("returns meetings for the tenant", async () => {
    const meeting = makeMeeting();
    const db = makeMockDb({ selectRows: [meeting] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).list({});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: MEETING_ID });
  });

  it("throws UNAUTHORIZED when tenantId is missing", async () => {
    const db = makeMockDb();
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], tenantId: null });
    await expect(caller(ctx).list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---------------------------------------------------------------------------
// meetings.create
// ---------------------------------------------------------------------------
describe("meetings.create", () => {
  it("inserts a meeting and returns it", async () => {
    const meeting = makeMeeting();
    const db = makeMockDb({ insertRows: [meeting] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).create({ title: "Sprint Planning" });
    expect(result).toMatchObject({ id: MEETING_ID, title: "Sprint Planning" });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("emits meeting.started event after insert", async () => {
    const meeting = makeMeeting();
    const db = makeMockDb({ insertRows: [meeting] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const handler = vi.fn();
    EventBus.on("meeting.started" as const, handler);

    await caller(ctx).create({ title: "Sprint Planning" });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "meeting.started",
        tenantId: TENANT_ID,
        payload: { meetingId: MEETING_ID },
      }),
    );
  });

  it("inserts participants when participantEmails is provided", async () => {
    const meeting = makeMeeting();
    const db = makeMockDb({ insertRows: [meeting] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    await caller(ctx).create({
      title: "Team Sync",
      participantEmails: ["alice@example.com", "bob@example.com"],
    });

    // insert called twice: once for meeting, once for participants
    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// meetings.uploadTranscript
// ---------------------------------------------------------------------------
describe("meetings.uploadTranscript", () => {
  it("inserts transcript rows for plain speaker:text format", async () => {
    const meeting = makeMeeting();
    const db = makeMockDb({
      selectSequence: [[meeting]],
      insertRows: [],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).uploadTranscript({
      meetingId: MEETING_ID,
      transcriptText: "Alice: Hello everyone\nBob: Good morning",
    });

    expect(result).toMatchObject({ id: MEETING_ID });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("inserts transcript rows for timestamped format", async () => {
    const meeting = makeMeeting();
    const db = makeMockDb({
      selectSequence: [[meeting]],
      insertRows: [],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    await caller(ctx).uploadTranscript({
      meetingId: MEETING_ID,
      transcriptText: "00:00:05 Alice: Hello everyone\n00:01:10 Bob: Good morning",
    });

    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("emits meeting.transcript.finalized event", async () => {
    const meeting = makeMeeting();
    const db = makeMockDb({
      selectSequence: [[meeting]],
      insertRows: [],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const handler = vi.fn();
    EventBus.on("meeting.transcript.finalized" as const, handler);

    await caller(ctx).uploadTranscript({
      meetingId: MEETING_ID,
      transcriptText: "Alice: Hello",
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "meeting.transcript.finalized",
        tenantId: TENANT_ID,
        payload: { meetingId: MEETING_ID },
      }),
    );
  });

  it("throws NOT_FOUND when meeting does not belong to tenant", async () => {
    const db = makeMockDb({ selectSequence: [[]] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    await expect(
      caller(ctx).uploadTranscript({
        meetingId: MEETING_ID,
        transcriptText: "Alice: text",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// meetings.search
// ---------------------------------------------------------------------------
describe("meetings.search", () => {
  it("returns meetings matching the query", async () => {
    const meeting = makeMeeting({ title: "Q4 Planning" });
    const db = makeMockDb({ selectRows: [meeting] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).search({ query: "Q4" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: "Q4 Planning" });
  });

  it("returns empty array when no meetings match the query", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).search({ query: "nonexistent" });

    expect(result).toEqual([]);
  });

  it("throws UNAUTHORIZED when tenantId is missing", async () => {
    const db = makeMockDb();
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], tenantId: null });

    await expect(caller(ctx).search({ query: "test" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ---------------------------------------------------------------------------
// meetings.transcribeAudio
// ---------------------------------------------------------------------------
describe("meetings.transcribeAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DEEPGRAM_API_KEY"];
  });

  it("returns configured:false when no DEEPGRAM_API_KEY is set", async () => {
    const db = makeMockDb();
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).transcribeAudio({
      meetingId: MEETING_ID,
      audioChunk: Buffer.from("fake-audio").toString("base64"),
      format: "webm",
    });

    expect(result.configured).toBe(false);
    expect(result.transcript).toBeNull();
  });

  it("returns a message when not configured", async () => {
    const db = makeMockDb();
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).transcribeAudio({
      meetingId: MEETING_ID,
      audioChunk: Buffer.from("fake-audio").toString("base64"),
      format: "wav",
    });

    expect(result.message).toBe("Add DEEPGRAM_API_KEY to .env to enable live transcription");
  });
});

// ---------------------------------------------------------------------------
// meetings.process
// ---------------------------------------------------------------------------
describe("meetings.process", () => {
  beforeEach(() => {
    EventBus.removeAllListeners();
    vi.clearAllMocks();
  });

  it("inserts a stub summary and returns it", async () => {
    const meeting = makeMeeting();
    const summary = {
      id: "00000000-0000-0000-0000-000000000099",
      meetingId: MEETING_ID,
      tenantId: TENANT_ID,
      summaryJson: { decisions: [], actionItems: [], followUps: [] },
      createdAt: new Date(),
    };
    const db = makeMockDb({
      selectSequence: [[meeting]],
      insertRows: [summary],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).process({ meetingId: MEETING_ID });

    expect(result).toMatchObject({ id: summary.id });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("enqueues a worker job", async () => {
    const { meetingProcessorQueue } = await import("../workers/meeting-processor.worker.js");
    const meeting = makeMeeting();
    const summary = {
      id: "sum-1",
      meetingId: MEETING_ID,
      tenantId: TENANT_ID,
      summaryJson: {},
      createdAt: new Date(),
    };
    const db = makeMockDb({ selectSequence: [[meeting]], insertRows: [summary] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    await caller(ctx).process({ meetingId: MEETING_ID });

    expect(meetingProcessorQueue.add).toHaveBeenCalledWith(
      "process-meeting",
      expect.objectContaining({ meetingId: MEETING_ID, tenantId: TENANT_ID }),
    );
  });

  it("emits meeting.summary.generated event", async () => {
    const meeting = makeMeeting();
    const summary = {
      id: "sum-2",
      meetingId: MEETING_ID,
      tenantId: TENANT_ID,
      summaryJson: {},
      createdAt: new Date(),
    };
    const db = makeMockDb({ selectSequence: [[meeting]], insertRows: [summary] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const handler = vi.fn();
    EventBus.on("meeting.summary.generated", handler);

    await caller(ctx).process({ meetingId: MEETING_ID });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "meeting.summary.generated",
        tenantId: TENANT_ID,
        payload: expect.objectContaining({ meetingId: MEETING_ID }),
      }),
    );
  });

  it("throws NOT_FOUND when meeting does not exist", async () => {
    const db = makeMockDb({ selectSequence: [[]] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    await expect(caller(ctx).process({ meetingId: MEETING_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
