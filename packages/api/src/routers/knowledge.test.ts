import { describe, it, expect, vi } from "vitest";
import type { TRPCContext } from "../context.js";

// Mock the event bus to prevent real event emission in tests
vi.mock("../events/bus.js", () => ({
  EventBus: { emit: vi.fn() },
  createEvent: vi.fn((e: Record<string, unknown>) => ({
    ...e,
    id: "test-id",
    createdAt: new Date(),
  })),
}));

// Mock @basicsos/db — provide a minimal documents table stub.
// The actual db connection and pool are never used; queries go through mockDb.
vi.mock("@basicsos/db", async () => {
  const drizzle = await import("drizzle-orm/pg-core");
  const documents = drizzle.pgTable("documents", {
    id: drizzle.uuid("id").primaryKey().defaultRandom(),
    tenantId: drizzle.uuid("tenant_id").notNull(),
    parentId: drizzle.uuid("parent_id"),
    title: drizzle.text("title").notNull(),
    contentJson: drizzle.jsonb("content_json"),
    position: drizzle.integer("position").notNull().default(0),
    createdBy: drizzle.uuid("created_by").notNull(),
    updatedBy: drizzle.uuid("updated_by"),
    createdAt: drizzle.timestamp("created_at").notNull().defaultNow(),
    updatedAt: drizzle.timestamp("updated_at").notNull().defaultNow(),
  });
  return { documents, db: {} };
});

import { knowledgeRouter } from "./knowledge.js";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const DOC_ID = "00000000-0000-0000-0000-000000000003";

const buildDoc = (overrides: Record<string, unknown> = {}) => ({
  id: DOC_ID,
  tenantId: TENANT_ID,
  parentId: null,
  title: "My Doc",
  contentJson: null,
  position: 0,
  createdBy: USER_ID,
  updatedBy: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ...overrides,
});

/**
 * Builds a mock Drizzle query chain that resolves to `returnValue` when awaited.
 * All chainable methods return the same chain object so that any combination of
 * .select().from().where() etc. eventually resolves.
 */
const makeChain = (returnValue: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, any> = {};
  const methods = [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "returning",
    "update",
    "set",
    "delete",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain["then"] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(returnValue).then(resolve, reject);
  chain["catch"] = (reject: (e: unknown) => unknown) => Promise.resolve(returnValue).catch(reject);
  return chain;
};

const buildMockDb = (queryResult: unknown[] = [], mutationResult: unknown[] = []) => {
  const selectChain = makeChain(queryResult);
  const insertChain = makeChain(mutationResult);
  const updateChain = makeChain(mutationResult);
  const deleteChain = makeChain([]);

  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    delete: vi.fn().mockReturnValue(deleteChain),
  };
};

const buildCtx = (db: TRPCContext["db"]): TRPCContext => ({
  db,
  userId: USER_ID,
  tenantId: TENANT_ID,
  role: "member",
  sessionId: "session-1",
  headers: new Headers(),
});

describe("knowledge.list", () => {
  it("returns documents for tenant at root level (parentId null)", async () => {
    const docs = [
      buildDoc(),
      buildDoc({ id: "00000000-0000-0000-0000-000000000004", title: "Second" }),
    ];
    const mockDb = buildMockDb(docs);
    const caller = knowledgeRouter.createCaller(buildCtx(mockDb as unknown as TRPCContext["db"]));

    const result = await caller.list({ parentId: null });
    expect(Array.isArray(result)).toBe(true);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("returns documents filtered by parentId when provided", async () => {
    const parent = "00000000-0000-0000-0000-000000000005";
    const child = buildDoc({ parentId: parent });
    const mockDb = buildMockDb([child]);
    const caller = knowledgeRouter.createCaller(buildCtx(mockDb as unknown as TRPCContext["db"]));

    const result = await caller.list({ parentId: parent });
    expect(Array.isArray(result)).toBe(true);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED when tenantId is missing", async () => {
    const mockDb = buildMockDb();
    const ctx: TRPCContext = {
      db: mockDb as unknown as TRPCContext["db"],
      userId: USER_ID,
      tenantId: null,
      role: "member",
      sessionId: "s",
      headers: new Headers(),
    };
    const caller = knowledgeRouter.createCaller(ctx);
    await expect(caller.list({ parentId: null })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("knowledge.create", () => {
  it("inserts a document and returns it", async () => {
    const doc = buildDoc();
    const mockDb = buildMockDb([], [doc]);
    const caller = knowledgeRouter.createCaller(buildCtx(mockDb as unknown as TRPCContext["db"]));

    const result = await caller.create({ title: "My Doc", position: 0 });
    expect(result).toMatchObject({ id: DOC_ID, title: "My Doc" });
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("throws FORBIDDEN for viewer role", async () => {
    const mockDb = buildMockDb();
    const ctx: TRPCContext = {
      db: mockDb as unknown as TRPCContext["db"],
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "viewer",
      sessionId: "s",
      headers: new Headers(),
    };
    const caller = knowledgeRouter.createCaller(ctx);
    await expect(caller.create({ title: "Test" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("knowledge.search", () => {
  it("returns matching documents for query", async () => {
    const docs = [buildDoc({ title: "Meeting Notes" })];
    const mockDb = buildMockDb(docs);
    const caller = knowledgeRouter.createCaller(buildCtx(mockDb as unknown as TRPCContext["db"]));

    const result = await caller.search({ query: "Meeting" });
    expect(Array.isArray(result)).toBe(true);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED when tenantId is missing", async () => {
    const mockDb = buildMockDb();
    const ctx: TRPCContext = {
      db: mockDb as unknown as TRPCContext["db"],
      userId: USER_ID,
      tenantId: null,
      role: "member",
      sessionId: "s",
      headers: new Headers(),
    };
    const caller = knowledgeRouter.createCaller(ctx);
    await expect(caller.search({ query: "test" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("knowledge.update", () => {
  it("updates a document and returns it", async () => {
    const doc = buildDoc({ title: "Updated" });
    // select returns [existing doc], update returns [updated doc]
    const mockDb = buildMockDb([doc], [doc]);
    const caller = knowledgeRouter.createCaller(buildCtx(mockDb as unknown as TRPCContext["db"]));

    const result = await caller.update({ id: DOC_ID, title: "Updated" });
    expect(result).toMatchObject({ id: DOC_ID });
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when document does not exist", async () => {
    const mockDb = buildMockDb([], []); // empty select result
    const caller = knowledgeRouter.createCaller(buildCtx(mockDb as unknown as TRPCContext["db"]));

    await expect(caller.update({ id: DOC_ID, title: "X" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("knowledge.delete", () => {
  it("deletes a document and returns its id", async () => {
    const doc = buildDoc();
    // select returns [existing], delete returns []
    const mockDb = buildMockDb([doc], []);
    const caller = knowledgeRouter.createCaller(buildCtx(mockDb as unknown as TRPCContext["db"]));

    const result = await caller.delete({ id: DOC_ID });
    expect(result).toEqual({ id: DOC_ID });
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when document does not exist", async () => {
    const mockDb = buildMockDb([], []);
    const caller = knowledgeRouter.createCaller(buildCtx(mockDb as unknown as TRPCContext["db"]));

    await expect(caller.delete({ id: DOC_ID })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("knowledge.reorder", () => {
  it("reorders documents and returns count", async () => {
    const mockDb = buildMockDb([], []);
    const caller = knowledgeRouter.createCaller(buildCtx(mockDb as unknown as TRPCContext["db"]));

    const result = await caller.reorder({
      updates: [
        { id: DOC_ID, position: 0 },
        { id: "00000000-0000-0000-0000-000000000004", position: 1 },
      ],
    });
    expect(result).toEqual({ updated: 2 });
    expect(mockDb.update).toHaveBeenCalled();
  });
});
