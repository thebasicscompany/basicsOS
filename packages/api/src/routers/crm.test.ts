import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "../context.js";
import { router } from "../trpc.js";
import { EventBus, createEvent } from "../events/bus.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const DEAL_ID = "00000000-0000-0000-0000-000000000003";

const buildCtx = (overrides: Partial<TRPCContext> = {}): TRPCContext => ({
  db: {} as TRPCContext["db"],
  userId: USER_ID,
  tenantId: TENANT_ID,
  role: "member",
  sessionId: "session-1",
  headers: new Headers(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Build a chainable Drizzle-like query mock
// A Drizzle select chain: db.select().from(table).where(cond) returns a
// PromiseLike that resolves to the provided rows. The chain is lazy — the
// promise only resolves when awaited.
// ---------------------------------------------------------------------------

function makeSelectChain(rows: unknown[]) {
  const thenable = {
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
    limit: vi.fn(() => Promise.resolve(rows)),
  };

  const where = vi.fn(() => thenable);
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select, from, where, thenable };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("crm.contacts.list", () => {
  it("returns empty array when no contacts", async () => {
    const { crmRouter } = await import("./crm.js");
    const testRouter = router({ crm: crmRouter });

    const chain = makeSelectChain([]);
    chain.thenable.limit.mockResolvedValue([]);

    const dbMock = { select: chain.select, execute: vi.fn().mockResolvedValue(undefined), transaction: vi.fn() };
    dbMock.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(dbMock));
    const ctx = buildCtx({
      db: dbMock as unknown as TRPCContext["db"],
    });

    const caller = testRouter.createCaller(ctx);
    const result = await caller.crm.contacts.list({});

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

describe("crm.deals.updateStage", () => {
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    emitSpy = vi.spyOn(EventBus, "emit");
    EventBus.removeAllListeners();
  });

  it("emits crm.deal.stage_changed event", async () => {
    const { crmRouter } = await import("./crm.js");
    const testRouter = router({ crm: crmRouter });

    const existingDeal = {
      id: DEAL_ID,
      tenantId: TENANT_ID,
      stage: "lead",
      value: "5000",
      title: "Test Deal",
    };
    const updatedDeal = { ...existingDeal, stage: "qualified" };

    const selectChain = makeSelectChain([existingDeal]);

    const returningMock = vi.fn().mockResolvedValue([updatedDeal]);
    const updateWhereMock = vi.fn(() => ({ returning: returningMock }));
    const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
    const updateMock = vi.fn(() => ({ set: updateSetMock }));

    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    const insertMock = vi.fn(() => ({ values: insertValuesMock }));

    const dbMock = {
      select: selectChain.select,
      update: updateMock,
      insert: insertMock,
      execute: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn(),
    };
    dbMock.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(dbMock));
    const ctx = buildCtx({
      db: dbMock as unknown as TRPCContext["db"],
    });

    const caller = testRouter.createCaller(ctx);
    await caller.crm.deals.updateStage({ id: DEAL_ID, stage: "qualified" });

    expect(emitSpy).toHaveBeenCalled();
    const firstEvent = emitSpy.mock.calls[0]?.[0] as { type: string } | undefined;
    expect(firstEvent?.type).toBe("crm.deal.stage_changed");
  });

  it("emits crm.deal.won when stage is 'won'", async () => {
    const { crmRouter } = await import("./crm.js");
    const testRouter = router({ crm: crmRouter });

    const existingDeal = {
      id: DEAL_ID,
      tenantId: TENANT_ID,
      stage: "negotiation",
      value: "10000",
      title: "Big Win",
    };
    const updatedDeal = { ...existingDeal, stage: "won" };

    const selectChain = makeSelectChain([existingDeal]);

    const returningMock = vi.fn().mockResolvedValue([updatedDeal]);
    const updateWhereMock = vi.fn(() => ({ returning: returningMock }));
    const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
    const updateMock = vi.fn(() => ({ set: updateSetMock }));

    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    const insertMock = vi.fn(() => ({ values: insertValuesMock }));

    const dbMock = {
      select: selectChain.select,
      update: updateMock,
      insert: insertMock,
      execute: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn(),
    };
    dbMock.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(dbMock));
    const ctx = buildCtx({
      db: dbMock as unknown as TRPCContext["db"],
    });

    const caller = testRouter.createCaller(ctx);
    await caller.crm.deals.updateStage({ id: DEAL_ID, stage: "won" });

    const emittedTypes = emitSpy.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(emittedTypes).toContain("crm.deal.stage_changed");
    expect(emittedTypes).toContain("crm.deal.won");
  });
});
