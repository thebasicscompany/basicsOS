import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "../context.js";

// ---------------------------------------------------------------------------
// Mocks — declared before any import that would trigger the real modules
// ---------------------------------------------------------------------------

vi.mock("@basicsos/db", () => ({
  contacts: {},
  companies: {},
  deals: {},
  dealActivities: {},
  db: {},
}));

vi.mock("../events/bus.js", () => ({
  EventBus: { emit: vi.fn() },
  createEvent: vi.fn((e: Record<string, unknown>) => ({
    ...e,
    id: "evt-id",
    createdAt: new Date(),
  })),
}));

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

import { router } from "../trpc.js";

// ---------------------------------------------------------------------------
// Build a chainable Drizzle-like query mock
// A Drizzle select chain: db.select().from(table).where(cond) returns a
// PromiseLike that resolves to the provided rows. The chain is lazy — the
// promise only resolves when awaited.
// ---------------------------------------------------------------------------

function makeSelectChain(rows: unknown[]) {
  // The final "thenable" object that resolves when awaited
  const thenable = {
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(rows).then(resolve, reject),
    // Support .limit() at the end of the chain too
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
    // .list calls .limit() after .where() — wire limit to resolve []
    chain.thenable.limit.mockResolvedValue([]);

    const ctx = buildCtx({
      db: { select: chain.select } as unknown as TRPCContext["db"],
    });

    const caller = testRouter.createCaller(ctx);
    const result = await caller.crm.contacts.list({});

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

describe("crm.deals.updateStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits crm.deal.stage_changed event", async () => {
    const { EventBus, createEvent } = await import("../events/bus.js");
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

    // Select mock: first call returns [existingDeal], subsequent calls don't matter
    const selectChain = makeSelectChain([existingDeal]);

    // Update mock: db.update(table).set({}).where({}).returning() => [updatedDeal]
    const returningMock = vi.fn().mockResolvedValue([updatedDeal]);
    const updateWhereMock = vi.fn(() => ({ returning: returningMock }));
    const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
    const updateMock = vi.fn(() => ({ set: updateSetMock }));

    const ctx = buildCtx({
      db: {
        select: selectChain.select,
        update: updateMock,
      } as unknown as TRPCContext["db"],
    });

    const caller = testRouter.createCaller(ctx);
    await caller.crm.deals.updateStage({ id: DEAL_ID, stage: "qualified" });

    expect(EventBus.emit).toHaveBeenCalled();
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "crm.deal.stage_changed" }),
    );

    const firstEmit = (EventBus.emit as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | { type: string }
      | undefined;
    expect(firstEmit?.type).toBe("crm.deal.stage_changed");
  });

  it("emits crm.deal.won when stage is 'won'", async () => {
    const { EventBus, createEvent } = await import("../events/bus.js");
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

    const ctx = buildCtx({
      db: {
        select: selectChain.select,
        update: updateMock,
      } as unknown as TRPCContext["db"],
    });

    const caller = testRouter.createCaller(ctx);
    await caller.crm.deals.updateStage({ id: DEAL_ID, stage: "won" });

    const allCalls = (EventBus.emit as ReturnType<typeof vi.fn>).mock.calls;
    const emittedTypes = allCalls.map((c) => (c[0] as { type: string }).type);

    expect(emittedTypes).toContain("crm.deal.stage_changed");
    expect(emittedTypes).toContain("crm.deal.won");
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "crm.deal.won" }),
    );
  });
});
