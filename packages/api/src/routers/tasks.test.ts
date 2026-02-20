import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "../context.js";
import { EventBus } from "../events/bus.js";

// ---------------------------------------------------------------------------
// Mock @basicsos/db so no real DB connection is required
// ---------------------------------------------------------------------------
vi.mock("@basicsos/db", () => {
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
  return { tasks, db: {} };
});

// After mocking, import the router
import { tasksRouter } from "./tasks.js";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const TASK_ID = "00000000-0000-0000-0000-000000000003";
const USER2_ID = "00000000-0000-0000-0000-000000000004";

// ---------------------------------------------------------------------------
// Thenable chain factory
//
// Drizzle chains look like: .select().from().where().orderBy()
// The terminal call (where, orderBy, returning) must return a Promise<row[]>.
// Additionally, non-terminal methods return `this` so further chaining works.
//
// We model this with a single "chain" object that is ALSO a Promise (thenable)
// resolving to `rows`. Every method returns `this`, so:
//   - .where()            → thenable resolving to rows (for get/getOverdue)
//   - .where().orderBy()  → thenable resolving to rows (for list)
//   - .where().returning()→ thenable resolving to rows (for update/delete)
// ---------------------------------------------------------------------------
const makeChain = (rows: unknown[]) => {
  const promise = Promise.resolve(rows);

  // Build a proxy-chain object that is itself a thenable
  const chain: Record<string, unknown> = {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };

  // All chainable methods return `this`
  for (const method of ["from", "where", "set", "values", "orderBy", "returning"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  return chain;
};

// ---------------------------------------------------------------------------
// DB mock builder
// Supports multiple sequential select calls via selectSequence.
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

  return {
    select: vi.fn().mockImplementation(() => {
      const rows = selectSequence ? (selectSequence[selectCallCount++] ?? []) : defaultSelectRows;
      return makeChain(rows);
    }),
    insert: vi.fn().mockReturnValue(makeChain(insertRows)),
    update: vi.fn().mockReturnValue(makeChain(updateRows)),
    delete: vi.fn().mockReturnValue(makeChain(deleteRows)),
  };
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

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: TASK_ID,
  tenantId: TENANT_ID,
  title: "Test task",
  description: null,
  status: "todo",
  priority: "medium",
  assigneeId: null,
  dueDate: null,
  labels: [],
  sourceType: null,
  sourceId: null,
  createdBy: USER_ID,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const caller = (ctx: TRPCContext) => tasksRouter.createCaller(ctx);

beforeEach(() => {
  EventBus.removeAllListeners();
});

// ---------------------------------------------------------------------------
// tasks.list
// ---------------------------------------------------------------------------
describe("tasks.list", () => {
  it("returns empty array for tenant with no tasks", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).list({});
    expect(result).toEqual([]);
  });

  it("returns tasks for the tenant", async () => {
    const task = makeTask();
    const db = makeMockDb({ selectRows: [task] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).list({});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: TASK_ID });
  });

  it("accepts optional filters without error", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).list({
      status: "in-progress",
      priority: "high",
    });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// tasks.create
// ---------------------------------------------------------------------------
describe("tasks.create", () => {
  it("inserts a task and returns it", async () => {
    const task = makeTask();
    const db = makeMockDb({ insertRows: [task] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).create({ title: "Test task" });
    expect(result).toMatchObject({ id: TASK_ID, title: "Test task" });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("emits task.created event after insert", async () => {
    const task = makeTask();
    const db = makeMockDb({ insertRows: [task] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const handler = vi.fn();
    EventBus.on("task.created" as const, handler);

    await caller(ctx).create({ title: "Test task" });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "task.created",
        tenantId: TENANT_ID,
        payload: { taskId: TASK_ID },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// tasks.update
// ---------------------------------------------------------------------------
describe("tasks.update", () => {
  it("emits task.completed when status changes to done", async () => {
    const existing = makeTask({ status: "in-progress" });
    const updated = makeTask({ status: "done" });

    const db = makeMockDb({
      selectSequence: [[existing]],
      updateRows: [updated],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const handler = vi.fn();
    EventBus.on("task.completed" as const, handler);

    await caller(ctx).update({ id: TASK_ID, status: "done" });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "task.completed",
        tenantId: TENANT_ID,
        payload: { taskId: TASK_ID },
      }),
    );
  });

  it("does not emit task.completed when status was already done", async () => {
    const existing = makeTask({ status: "done" });
    const updated = makeTask({ status: "done" });

    const db = makeMockDb({
      selectSequence: [[existing]],
      updateRows: [updated],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const handler = vi.fn();
    EventBus.on("task.completed" as const, handler);

    await caller(ctx).update({ id: TASK_ID, status: "done" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("emits task.assigned when assigneeId changes", async () => {
    const existing = makeTask({ assigneeId: null });
    const updated = makeTask({ assigneeId: USER2_ID });

    const db = makeMockDb({
      selectSequence: [[existing]],
      updateRows: [updated],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const handler = vi.fn();
    EventBus.on("task.assigned" as const, handler);

    await caller(ctx).update({ id: TASK_ID, assigneeId: USER2_ID });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "task.assigned",
        tenantId: TENANT_ID,
        payload: { taskId: TASK_ID, assigneeId: USER2_ID },
      }),
    );
  });

  it("emits both task.completed and task.assigned when both change simultaneously", async () => {
    const existing = makeTask({ status: "todo", assigneeId: null });
    const updated = makeTask({ status: "done", assigneeId: USER2_ID });

    const db = makeMockDb({
      selectSequence: [[existing]],
      updateRows: [updated],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const completedHandler = vi.fn();
    const assignedHandler = vi.fn();
    EventBus.on("task.completed" as const, completedHandler);
    EventBus.on("task.assigned" as const, assignedHandler);

    await caller(ctx).update({ id: TASK_ID, status: "done", assigneeId: USER2_ID });

    expect(completedHandler).toHaveBeenCalledOnce();
    expect(assignedHandler).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND when task does not exist", async () => {
    const db = makeMockDb({ selectSequence: [[]] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    await expect(caller(ctx).update({ id: TASK_ID, status: "done" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// tasks.getOverdue
// ---------------------------------------------------------------------------
describe("tasks.getOverdue", () => {
  it("returns tasks with dueDate in the past and status not done", async () => {
    const overdueTask = makeTask({
      dueDate: new Date("2020-01-01"),
      status: "todo",
    });
    const db = makeMockDb({ selectRows: [overdueTask] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).getOverdue();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: TASK_ID, status: "todo" });
  });

  it("returns empty array when all tasks are done or not overdue", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).getOverdue();

    expect(result).toEqual([]);
  });

  it("returns empty array when no tasks exist", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).getOverdue();

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// tasks.get
// ---------------------------------------------------------------------------
describe("tasks.get", () => {
  it("returns a single task by id", async () => {
    const task = makeTask();
    const db = makeMockDb({ selectRows: [task] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).get({ id: TASK_ID });

    expect(result).toMatchObject({ id: TASK_ID });
  });

  it("throws NOT_FOUND when task does not exist", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    await expect(caller(ctx).get({ id: TASK_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// tasks.delete
// ---------------------------------------------------------------------------
describe("tasks.delete", () => {
  it("returns success when task is deleted", async () => {
    const task = makeTask();
    const db = makeMockDb({ deleteRows: [task] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).delete({ id: TASK_ID });

    expect(result).toEqual({ success: true });
  });

  it("throws NOT_FOUND when task does not exist", async () => {
    const db = makeMockDb({ deleteRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    await expect(caller(ctx).delete({ id: TASK_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
