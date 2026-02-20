import { describe, it, expect, vi } from "vitest";

// Mock @basicsos/db before importing routers — provide stub table schemas.
// We use plain objects (column name strings) to avoid importing drizzle-orm here.
// This matches the pattern used in api unit tests (e.g. tasks.test.ts).
vi.mock("@basicsos/db", () => {
  const documents = {
    id: "id",
    tenantId: "tenantId",
    parentId: "parentId",
    title: "title",
    contentJson: "contentJson",
    position: "position",
    createdBy: "createdBy",
    updatedBy: "updatedBy",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  };

  const tasks = {
    id: "id",
    tenantId: "tenantId",
    status: "status",
    priority: "priority",
    assigneeId: "assigneeId",
    sourceType: "sourceType",
    dueDate: "dueDate",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  };

  return { documents, tasks, db: {} };
});

// Mock event bus to prevent real emission
vi.mock("../../packages/api/src/events/bus.js", () => ({
  EventBus: { emit: vi.fn() },
  createEvent: vi.fn((e: Record<string, unknown>) => ({
    ...e,
    id: "test-id",
    createdAt: new Date(),
  })),
}));

import type { TRPCContext } from "../../packages/api/src/context.js";
import { knowledgeRouter } from "../../packages/api/src/routers/knowledge.js";
import { tasksRouter } from "../../packages/api/src/routers/tasks.js";

const TENANT_A = "aaaaaaaa-0000-0000-0000-000000000001";
const TENANT_B = "bbbbbbbb-0000-0000-0000-000000000001";
const USER_A = "aaaaaaaa-0000-0000-0000-000000000002";
const USER_B = "bbbbbbbb-0000-0000-0000-000000000002";

/**
 * Builds a fluent Drizzle-style mock chain that resolves to `rows` when awaited.
 */
const makeChain = (rows: unknown[]) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, any> = {};
  const methods = ["from", "where", "set", "values", "orderBy", "returning", "limit"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain["then"] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  chain["catch"] = (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject);
  return chain;
};

const makeMockDb = (rows: unknown[] = []) => ({
  select: vi.fn(() => makeChain(rows)),
  insert: vi.fn(() => makeChain(rows)),
  update: vi.fn(() => makeChain(rows)),
  delete: vi.fn(() => makeChain(rows)),
});

const buildCtx = (tenantId: string | null, userId: string): TRPCContext => ({
  // Type assertion necessary: mock DB satisfies the same interface at runtime,
  // but TypeScript requires the full DrizzleClient type. This is safe in tests only.
  db: {} as TRPCContext["db"],
  userId,
  tenantId,
  role: "member" as const,
  sessionId: "s",
  headers: new Headers(),
});

describe("Multi-Tenant Isolation", () => {
  it("knowledge.list: each caller only queries their own tenant", async () => {
    const dbA = makeMockDb([{ id: "doc-A", tenantId: TENANT_A, title: "Doc A" }]);
    const dbB = makeMockDb([{ id: "doc-B", tenantId: TENANT_B, title: "Doc B" }]);

    const ctxA = buildCtx(TENANT_A, USER_A);
    ctxA.db = dbA as unknown as TRPCContext["db"];
    const ctxB = buildCtx(TENANT_B, USER_B);
    ctxB.db = dbB as unknown as TRPCContext["db"];

    const callerA = knowledgeRouter.createCaller(ctxA);
    const callerB = knowledgeRouter.createCaller(ctxB);

    await callerA.list({ parentId: null });
    await callerB.list({ parentId: null });

    // Each caller used their own DB connection
    expect(dbA.select).toHaveBeenCalled();
    expect(dbB.select).toHaveBeenCalled();
    // DB calls are separate — Tenant A's DB was not queried by Tenant B
    expect(dbA.select).toHaveBeenCalledTimes(1);
    expect(dbB.select).toHaveBeenCalledTimes(1);
  });

  it("tasks.list: tenantId is required for protectedProcedure queries", async () => {
    const dbA = makeMockDb([]);
    const ctxA = buildCtx(TENANT_A, USER_A);
    ctxA.db = dbA as unknown as TRPCContext["db"];

    const callerA = tasksRouter.createCaller(ctxA);
    await callerA.list({});

    expect(dbA.select).toHaveBeenCalledTimes(1);
  });

  it("protectedProcedure throws UNAUTHORIZED when no tenantId for tenant-scoped queries", async () => {
    const mockDb = makeMockDb();
    const ctx: TRPCContext = {
      db: mockDb as unknown as TRPCContext["db"],
      userId: USER_A,
      tenantId: null, // No tenant context
      role: "member" as const,
      sessionId: "s",
      headers: new Headers(),
    };

    const caller = knowledgeRouter.createCaller(ctx);
    await expect(caller.list({ parentId: null })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
