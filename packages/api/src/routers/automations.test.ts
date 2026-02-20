import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "../context.js";

// ---------------------------------------------------------------------------
// Mock @basicsos/db — no real DB connection required
// ---------------------------------------------------------------------------
vi.mock("@basicsos/db", () => {
  const automations = {
    id: "id",
    tenantId: "tenantId",
    name: "name",
    enabled: "enabled",
    triggerConfig: "triggerConfig",
    actionChain: "actionChain",
    lastRunAt: "lastRunAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  };
  const automationRuns = {
    id: "id",
    automationId: "automationId",
    status: "status",
    startedAt: "startedAt",
    completedAt: "completedAt",
    result: "result",
    error: "error",
  };
  return {
    automations,
    automationRuns,
    db: {},
    users: { id: "id", name: "name", email: "email", role: "role", tenantId: "tenantId", onboardedAt: "onboardedAt", createdAt: "createdAt" },
    sessions: { id: "id", userId: "userId", token: "token", expiresAt: "expiresAt" },
    accounts: { id: "id", userId: "userId", providerId: "providerId", accountId: "accountId" },
    verifications: { id: "id", identifier: "identifier", value: "value", expiresAt: "expiresAt" },
    tenants: { id: "id", name: "name", slug: "slug", createdAt: "createdAt" },
    invites: { id: "id", tenantId: "tenantId", email: "email", role: "role", token: "token", acceptedAt: "acceptedAt", expiresAt: "expiresAt", createdAt: "createdAt" },
  };
});

import { automationsRouter } from "./automations.js";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const AUTOMATION_ID = "00000000-0000-0000-0000-000000000003";

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
  } = {},
) => {
  const db = {
    select: vi.fn().mockImplementation(() => makeChain(opts.selectRows ?? [])),
    insert: vi.fn().mockReturnValue(makeChain(opts.insertRows ?? [])),
    update: vi.fn().mockReturnValue(makeChain(opts.updateRows ?? [])),
    delete: vi.fn().mockReturnValue(makeChain(opts.deleteRows ?? [])),
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

const makeAutomation = (overrides: Record<string, unknown> = {}) => ({
  id: AUTOMATION_ID,
  tenantId: TENANT_ID,
  name: "Test Automation",
  triggerConfig: { eventType: "task.created", conditions: [] },
  actionChain: [{ type: "send_email", config: {} }],
  enabled: true,
  lastRunAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const caller = (ctx: TRPCContext) => automationsRouter.createCaller(ctx);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// automations.list
// ---------------------------------------------------------------------------
describe("automations.list", () => {
  it("returns empty array for tenant with no automations", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).list();
    expect(result).toEqual([]);
  });

  it("returns automations for the tenant", async () => {
    const automation = makeAutomation();
    const db = makeMockDb({ selectRows: [automation] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).list();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: AUTOMATION_ID });
  });

  it("throws UNAUTHORIZED when tenantId is null", async () => {
    const db = makeMockDb();
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], tenantId: null });
    await expect(caller(ctx).list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---------------------------------------------------------------------------
// automations.create
// ---------------------------------------------------------------------------
describe("automations.create", () => {
  it("inserts and returns a new automation", async () => {
    const automation = makeAutomation();
    const db = makeMockDb({ insertRows: [automation] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).create({
      name: "Test Automation",
      triggerConfig: { eventType: "task.created", conditions: [] },
      actionChain: [{ type: "send_email", config: {} }],
      enabled: true,
    });
    expect(result).toMatchObject({ id: AUTOMATION_ID, name: "Test Automation" });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("throws INTERNAL_SERVER_ERROR when insert returns nothing", async () => {
    const db = makeMockDb({ insertRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(
      caller(ctx).create({
        name: "Test Automation",
        triggerConfig: { eventType: "task.created", conditions: [] },
        actionChain: [{ type: "send_email", config: {} }],
        enabled: true,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ---------------------------------------------------------------------------
// automations.get
// ---------------------------------------------------------------------------
describe("automations.get", () => {
  it("throws NOT_FOUND for an unknown id", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(caller(ctx).get({ id: AUTOMATION_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns automation when found", async () => {
    const automation = makeAutomation();
    const db = makeMockDb({ selectRows: [automation] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).get({ id: AUTOMATION_ID });
    expect(result).toMatchObject({ id: AUTOMATION_ID });
  });
});

// ---------------------------------------------------------------------------
// automations.setEnabled
// ---------------------------------------------------------------------------
describe("automations.setEnabled", () => {
  it("updates the enabled field and returns the automation", async () => {
    const automation = makeAutomation({ enabled: false });
    const db = makeMockDb({ updateRows: [automation] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).setEnabled({ id: AUTOMATION_ID, enabled: false });
    expect(result).toMatchObject({ id: AUTOMATION_ID, enabled: false });
    expect(db.update).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND when automation does not exist", async () => {
    const db = makeMockDb({ updateRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(
      caller(ctx).setEnabled({ id: AUTOMATION_ID, enabled: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// automations.delete
// ---------------------------------------------------------------------------
describe("automations.delete", () => {
  it("returns { success: true } when automation is deleted", async () => {
    const automation = makeAutomation();
    const db = makeMockDb({ deleteRows: [automation] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).delete({ id: AUTOMATION_ID });
    expect(result).toEqual({ success: true });
  });

  it("throws NOT_FOUND when automation does not exist", async () => {
    const db = makeMockDb({ deleteRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(caller(ctx).delete({ id: AUTOMATION_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// automations.update
// ---------------------------------------------------------------------------
describe("automations.update", () => {
  it("returns updated automation", async () => {
    const updated = makeAutomation({ name: "Updated Name" });
    const db = makeMockDb({ updateRows: [updated] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).update({ id: AUTOMATION_ID, name: "Updated Name" });
    expect(result).toMatchObject({ id: AUTOMATION_ID, name: "Updated Name" });
  });

  it("throws NOT_FOUND when automation does not exist", async () => {
    const db = makeMockDb({ updateRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(caller(ctx).update({ id: AUTOMATION_ID, enabled: false })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
