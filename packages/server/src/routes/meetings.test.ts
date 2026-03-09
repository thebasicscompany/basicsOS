import { describe, expect, it, vi } from "vitest";

/**
 * Tests for meetings route handlers. Uses the same mock pattern as
 * create.test.ts — testing handlers directly with mocked context and DB,
 * bypassing Hono routing and auth middleware.
 */

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: () => async (c: any, next: () => Promise<void>) => {
    // Always set a valid session so getCrmUser can find the user
    c.set("session", { user: { id: "user-1" } });
    return next();
  },
}));

vi.mock("../lib/org-ai-config.js", () => ({
  resolveOrgAiConfig: vi.fn().mockResolvedValue({ ok: false }),
  buildGatewayHeaders: vi.fn().mockReturnValue({}),
}));

const ORG_ID = "org-test-1";
const CRM_USER = {
  id: 11,
  organizationId: ORG_ID,
  userId: "user-1",
};

// Helper: build a mock Hono context
function _makeContext(
  params: Record<string, string>,
  query: Record<string, string> = {},
  payload?: unknown,
  userId = "user-1",
) {
  return {
    req: {
      param: (key: string) => params[key] ?? "",
      query: (key: string) => query[key],
      json: async () => payload ?? {},
      raw: { headers: new Headers() },
      header: () => undefined,
    },
    get: (key: string) => {
      if (key === "session") return { user: { id: userId } };
      return undefined;
    },
    set: () => {},
    json: (body: unknown, status = 200) => ({ status, body }),
  } as any;
}

// Helper: chain mocks for DB select
/**
 * Creates a chainable Drizzle select mock.
 * Each call to db.select() uses the next result from the array.
 * The chain supports: .from().where().orderBy().limit().offset()
 * and any suffix thereof (e.g., .where().limit(1) for single-row queries).
 *
 * Terminal methods (.limit() without .offset(), .offset()) return a Promise.
 */
function makeDbSelect(results: unknown[][] = []) {
  let callIdx = 0;
  return vi.fn().mockImplementation(() => {
    const idx = callIdx++;
    const data = results[idx] ?? [];

    // Promise-like object that also has .offset()
    const makeLimitResult = () => {
      const p = Promise.resolve(data);
      (p as any).offset = vi.fn().mockResolvedValue(data);
      return p;
    };

    // Make chain thenable at any point — awaiting it returns data
    const chain: Record<string, any> = {
      then: (resolve: any, reject?: any) =>
        Promise.resolve(data).then(resolve, reject),
    };
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockImplementation(makeLimitResult);
    chain.offset = vi.fn().mockResolvedValue(data);

    return chain;
  });
}

describe("meetings route handlers (unit tests)", () => {
  describe("POST / — create meeting", () => {
    it("creates a meeting and returns 201", async () => {
      const insertValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            organizationId: ORG_ID,
            crmUserId: CRM_USER.id,
            status: "recording",
            startedAt: new Date().toISOString(),
          },
        ]),
      });
      const db = {
        select: makeDbSelect([[CRM_USER]]),
        insert: vi.fn().mockReturnValue({ values: insertValues }),
      };

      // Import and call the route's create handler through Hono
      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe(1);
      expect(data.status).toBe("recording");
      expect(db.insert).toHaveBeenCalled();
    });

    it("returns 401 when no crmUser", async () => {
      const db = {
        select: makeDbSelect([[]]), // no crmUser found
        insert: vi.fn(),
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/", { method: "POST" }),
      );

      expect(res.status).toBe(401);
    });
  });

  describe("GET / — list meetings", () => {
    it("returns meetings array", async () => {
      const meetings = [
        {
          id: 1,
          title: "Test",
          status: "completed",
          startedAt: new Date().toISOString(),
        },
      ];
      const db = {
        select: makeDbSelect([[CRM_USER], meetings]),
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/?page=1&perPage=10"),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it("returns 401 when no crmUser", async () => {
      const db = { select: makeDbSelect([[]]) };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(new Request("http://localhost/"));

      expect(res.status).toBe(401);
    });
  });

  describe("GET /:id — get meeting detail", () => {
    it("returns 400 for non-numeric ID", async () => {
      const db = { select: makeDbSelect([[CRM_USER]]) };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(new Request("http://localhost/abc"));

      expect(res.status).toBe(400);
    });

    it("returns 404 when meeting not found", async () => {
      const db = {
        select: makeDbSelect([[CRM_USER], []]),
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(new Request("http://localhost/999"));

      expect(res.status).toBe(404);
    });

    it("returns meeting with transcripts and summary", async () => {
      const meeting = {
        id: 1,
        organizationId: ORG_ID,
        title: "Team Standup",
        status: "completed",
      };
      const transcripts = [
        { id: 1, speaker: "You", text: "Hello", timestampMs: 0 },
      ];
      const summary = [
        { id: 1, summaryJson: { note: "A standup" } },
      ];
      const db = {
        select: makeDbSelect([
          [CRM_USER],
          [meeting],
          transcripts,
          summary,
        ]),
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(new Request("http://localhost/1"));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe("Team Standup");
      expect(data).toHaveProperty("transcripts");
      expect(data.summary).toBeTruthy();
      expect(data.summary.summaryJson.note).toBe("A standup");
    });
  });

  describe("POST /:id/transcript — upload transcript", () => {
    it("returns 404 when meeting not found", async () => {
      const db = {
        select: makeDbSelect([[CRM_USER], []]),
        insert: vi.fn(),
        update: vi.fn(),
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/999/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Hello" }),
        }),
      );

      expect(res.status).toBe(404);
    });

    it("uploads structured segments and updates status to processing", async () => {
      const meeting = {
        id: 5,
        organizationId: ORG_ID,
        status: "recording",
        startedAt: new Date(Date.now() - 60000).toISOString(),
      };
      const insertValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      });
      const updateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const db = {
        select: makeDbSelect([[CRM_USER], [meeting]]),
        insert: vi.fn().mockReturnValue({ values: insertValues }),
        update: vi.fn().mockReturnValue({ set: updateSet }),
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/5/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segments: [
              { speaker: "You", text: "Hello", timestampMs: 0 },
              { speaker: "Speaker 1", text: "Hi", timestampMs: 1500 },
            ],
          }),
        }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(db.insert).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
      // Verify status was set to "processing"
      const setCall = updateSet.mock.calls[0][0];
      expect(setCall.status).toBe("processing");
    });

    it("parses plain text with speaker labels", async () => {
      const meeting = {
        id: 5,
        organizationId: ORG_ID,
        status: "recording",
        startedAt: new Date(Date.now() - 30000).toISOString(),
      };
      const insertValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      });
      const db = {
        select: makeDbSelect([[CRM_USER], [meeting]]),
        insert: vi.fn().mockReturnValue({ values: insertValues }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/5/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "You: Hello world\nSpeaker 1: Hey there",
          }),
        }),
      );

      expect(res.status).toBe(200);
      // Verify insert was called with parsed segments
      const segments = insertValues.mock.calls[0][0];
      expect(segments).toHaveLength(2);
      expect(segments[0].speaker).toBe("You");
      expect(segments[0].text).toBe("Hello world");
      expect(segments[1].speaker).toBe("Speaker 1");
    });
  });

  describe("POST /:id/process — summarization", () => {
    it("marks completed with null summary when no transcript", async () => {
      const meeting = {
        id: 5,
        organizationId: ORG_ID,
        status: "processing",
      };
      const db = {
        select: makeDbSelect([[CRM_USER], [meeting], []]),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/5/process", { method: "POST" }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.summary).toBeNull();
    });

    it("marks completed when no AI config available", async () => {
      const meeting = {
        id: 5,
        organizationId: ORG_ID,
        status: "processing",
      };
      const transcripts = [
        { id: 1, speaker: "You", text: "Discussion content", timestampMs: 0 },
      ];
      const db = {
        select: makeDbSelect([[CRM_USER], [meeting], transcripts]),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/5/process", { method: "POST" }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.summary).toBeNull();
    });
  });

  describe("DELETE /:id — delete meeting", () => {
    it("returns 400 for non-numeric ID", async () => {
      const db = { select: makeDbSelect([[CRM_USER]]), delete: vi.fn() };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/abc", { method: "DELETE" }),
      );

      expect(res.status).toBe(400);
    });

    it("deletes meeting and returns ok", async () => {
      const deleteFn = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const db = {
        select: makeDbSelect([[CRM_USER]]),
        delete: deleteFn,
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/123", { method: "DELETE" }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(deleteFn).toHaveBeenCalled();
    });

    it("returns 401 when no crmUser", async () => {
      const db = {
        select: makeDbSelect([[]]),
        delete: vi.fn(),
      };

      const { createMeetingsRoutes } = await import("@/routes/meetings.js");
      const app = createMeetingsRoutes(db as any, {} as any, {} as any);
      const res = await app.request(
        new Request("http://localhost/123", { method: "DELETE" }),
      );

      expect(res.status).toBe(401);
    });
  });
});
