import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "../context.js";
import { EventBus } from "../events/bus.js";

// ---------------------------------------------------------------------------
// Mock @basicsos/db — no real DB connection required
// ---------------------------------------------------------------------------
vi.mock("@basicsos/db", () => {
  const aiEmployeeJobs = {
    id: "id",
    tenantId: "tenantId",
    title: "title",
    instructions: "instructions",
    status: "status",
    sandboxId: "sandboxId",
    startedAt: "startedAt",
    completedAt: "completedAt",
    costUsd: "costUsd",
    createdBy: "createdBy",
    createdAt: "createdAt",
  };
  const aiEmployeeOutputs = {
    id: "id",
    jobId: "jobId",
    type: "type",
    content: "content",
    requiresApproval: "requiresApproval",
    approvedAt: "approvedAt",
    approvedBy: "approvedBy",
    createdAt: "createdAt",
  };
  return {
    aiEmployeeJobs,
    aiEmployeeOutputs,
    db: {},
    users: { id: "id", name: "name", email: "email", role: "role", tenantId: "tenantId", onboardedAt: "onboardedAt", createdAt: "createdAt" },
    sessions: { id: "id", userId: "userId", token: "token", expiresAt: "expiresAt" },
    accounts: { id: "id", userId: "userId", providerId: "providerId", accountId: "accountId" },
    verifications: { id: "id", identifier: "identifier", value: "value", expiresAt: "expiresAt" },
    tenants: { id: "id", name: "name", slug: "slug", createdAt: "createdAt" },
    invites: { id: "id", tenantId: "tenantId", email: "email", role: "role", token: "token", acceptedAt: "acceptedAt", expiresAt: "expiresAt", createdAt: "createdAt" },
  };
});

import { aiEmployeesRouter } from "./ai-employees.js";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const JOB_ID = "00000000-0000-0000-0000-000000000003";
const OUTPUT_ID = "00000000-0000-0000-0000-000000000004";

// ---------------------------------------------------------------------------
// Thenable chain factory — mirrors the pattern used in tasks.test.ts
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

const makeJob = (overrides: Record<string, unknown> = {}) => ({
  id: JOB_ID,
  tenantId: TENANT_ID,
  title: "Summarize all deals",
  instructions: "Look at all CRM deals and write a summary.",
  status: "pending",
  sandboxId: null,
  startedAt: null,
  completedAt: null,
  costUsd: "0.0000",
  createdBy: USER_ID,
  createdAt: new Date("2024-01-01"),
  ...overrides,
});

const makeOutput = (overrides: Record<string, unknown> = {}) => ({
  id: OUTPUT_ID,
  jobId: JOB_ID,
  type: "text",
  content: "Here is the summary.",
  requiresApproval: false,
  approvedAt: null,
  approvedBy: null,
  createdAt: new Date("2024-01-01"),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const caller = (ctx: TRPCContext) => aiEmployeesRouter.createCaller(ctx);

beforeEach(() => {
  EventBus.removeAllListeners();
});

// ---------------------------------------------------------------------------
// aiEmployees.listJobs
// ---------------------------------------------------------------------------
describe("aiEmployees.listJobs", () => {
  it("returns empty array for tenant with no jobs", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).listJobs();
    expect(result).toEqual([]);
  });

  it("returns jobs for the tenant", async () => {
    const job = makeJob();
    const db = makeMockDb({ selectRows: [job] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).listJobs();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: JOB_ID });
  });

  it("throws UNAUTHORIZED when tenantId is missing", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], tenantId: null });
    await expect(caller(ctx).listJobs()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---------------------------------------------------------------------------
// aiEmployees.createJob
// ---------------------------------------------------------------------------
describe("aiEmployees.createJob", () => {
  it("inserts a job and returns it", async () => {
    const job = makeJob();
    const db = makeMockDb({ insertRows: [job] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).createJob({
      title: "Summarize all deals",
      instructions: "Look at all CRM deals and write a summary.",
    });
    expect(result).toMatchObject({ id: JOB_ID, status: "pending" });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("emits ai_employee.started event after insert", async () => {
    const job = makeJob();
    const db = makeMockDb({ insertRows: [job] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const handler = vi.fn();
    EventBus.on("ai_employee.started" as const, handler);

    await caller(ctx).createJob({
      title: "Summarize all deals",
      instructions: "Look at all CRM deals and write a summary.",
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ai_employee.started",
        tenantId: TENANT_ID,
        payload: { jobId: JOB_ID },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// aiEmployees.kill
// ---------------------------------------------------------------------------
describe("aiEmployees.kill", () => {
  it("updates status to killed and returns updated job", async () => {
    const job = makeJob({ status: "killed" });
    const db = makeMockDb({ updateRows: [job] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], role: "admin" });
    const result = await caller(ctx).kill({ id: JOB_ID });
    expect(result).toMatchObject({ id: JOB_ID, status: "killed" });
    expect(db.update).toHaveBeenCalledOnce();
  });

  it("emits ai_employee.killed event after update", async () => {
    const job = makeJob({ status: "killed" });
    const db = makeMockDb({ updateRows: [job] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], role: "admin" });

    const handler = vi.fn();
    EventBus.on("ai_employee.killed" as const, handler);

    await caller(ctx).kill({ id: JOB_ID });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ai_employee.killed",
        tenantId: TENANT_ID,
        payload: { jobId: JOB_ID },
      }),
    );
  });

  it("throws NOT_FOUND when job does not exist", async () => {
    const db = makeMockDb({ updateRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], role: "admin" });
    await expect(caller(ctx).kill({ id: JOB_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// aiEmployees.getJob
// ---------------------------------------------------------------------------
describe("aiEmployees.getJob", () => {
  it("returns a job with its outputs", async () => {
    const job = makeJob();
    const output = makeOutput();
    const db = makeMockDb({ selectSequence: [[job], [output]] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).getJob({ id: JOB_ID });
    expect(result).toMatchObject({ id: JOB_ID });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]).toMatchObject({ id: OUTPUT_ID });
  });

  it("throws NOT_FOUND for unknown id", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(caller(ctx).getJob({ id: JOB_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws UNAUTHORIZED when tenantId is missing", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], tenantId: null });
    await expect(caller(ctx).getJob({ id: JOB_ID })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ---------------------------------------------------------------------------
// aiEmployees.listOutputs
// ---------------------------------------------------------------------------
describe("aiEmployees.listOutputs", () => {
  it("returns outputs for a job", async () => {
    const job = makeJob();
    const output = makeOutput();
    const db = makeMockDb({ selectSequence: [[job], [output]] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).listOutputs({ jobId: JOB_ID });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: OUTPUT_ID });
  });

  it("throws NOT_FOUND when job does not belong to tenant", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(caller(ctx).listOutputs({ jobId: JOB_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// aiEmployees.approveOutput
// ---------------------------------------------------------------------------
describe("aiEmployees.approveOutput", () => {
  it("approves an output and clears requiresApproval", async () => {
    const output = makeOutput({ requiresApproval: true });
    const job = makeJob();
    const approved = makeOutput({
      requiresApproval: false,
      approvedAt: new Date(),
      approvedBy: USER_ID,
    });
    const db = makeMockDb({ selectSequence: [[output], [job]], updateRows: [approved] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).approveOutput({ outputId: OUTPUT_ID });
    expect(result).toMatchObject({ id: OUTPUT_ID, requiresApproval: false });
  });

  it("throws NOT_FOUND when output does not exist", async () => {
    const db = makeMockDb({ selectSequence: [[]] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(caller(ctx).approveOutput({ outputId: OUTPUT_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws FORBIDDEN when output's job belongs to different tenant", async () => {
    const output = makeOutput();
    const db = makeMockDb({ selectSequence: [[output], []] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(caller(ctx).approveOutput({ outputId: OUTPUT_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
