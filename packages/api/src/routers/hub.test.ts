import { describe, it, expect, vi } from "vitest";
import type { TRPCContext } from "../context.js";

// ---------------------------------------------------------------------------
// Mock @basicsos/db so no real DB connection is required
// ---------------------------------------------------------------------------
vi.mock("@basicsos/db", () => {
  const hubLinks = {
    id: "id",
    tenantId: "tenantId",
    title: "title",
    url: "url",
    icon: "icon",
    category: "category",
    position: "position",
    createdAt: "createdAt",
  };
  const integrations = {
    id: "id",
    tenantId: "tenantId",
    service: "service",
    oauthTokenEnc: "oauthTokenEnc",
    scopes: "scopes",
    connectedAt: "connectedAt",
    createdAt: "createdAt",
  };
  return { hubLinks, integrations, db: {} };
});

// After mocking, import the router
import { hubRouter } from "./hub.js";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const LINK_ID = "00000000-0000-0000-0000-000000000003";

// ---------------------------------------------------------------------------
// Thenable chain factory
// ---------------------------------------------------------------------------
const makeChain = (rows: unknown[]) => {
  const promise = Promise.resolve(rows);

  const chain: Record<string, unknown> = {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };

  for (const method of ["from", "where", "set", "values", "orderBy", "returning"]) {
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
// Context builder — admin role needed for adminProcedure
// ---------------------------------------------------------------------------
const buildCtx = (overrides: Partial<TRPCContext> = {}): TRPCContext => ({
  db: {} as TRPCContext["db"],
  userId: USER_ID,
  tenantId: TENANT_ID,
  role: "admin",
  sessionId: "session-1",
  headers: new Headers(),
  ...overrides,
});

const makeLink = (overrides: Record<string, unknown> = {}) => ({
  id: LINK_ID,
  tenantId: TENANT_ID,
  title: "Engineering Docs",
  url: "https://docs.example.com",
  icon: null,
  category: "custom",
  position: 0,
  createdAt: new Date("2024-01-01"),
  ...overrides,
});

const makeIntegration = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-0000-0000-000000000010",
  tenantId: TENANT_ID,
  service: "slack",
  oauthTokenEnc: "placeholder-encrypted-token",
  scopes: null,
  connectedAt: new Date("2024-01-01"),
  createdAt: new Date("2024-01-01"),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const caller = (ctx: TRPCContext) => hubRouter.createCaller(ctx);

// ---------------------------------------------------------------------------
// hub.listLinks
// ---------------------------------------------------------------------------
describe("hub.listLinks", () => {
  it("returns empty array for tenant with no links", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).listLinks();
    expect(result).toEqual([]);
  });

  it("returns links for the tenant", async () => {
    const link = makeLink();
    const db = makeMockDb({ selectRows: [link] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).listLinks();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: LINK_ID, title: "Engineering Docs" });
  });

  it("throws UNAUTHORIZED when tenantId is null", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], tenantId: null });
    await expect(caller(ctx).listLinks()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---------------------------------------------------------------------------
// hub.createLink
// ---------------------------------------------------------------------------
describe("hub.createLink", () => {
  it("inserts a link and returns it", async () => {
    const link = makeLink();
    const db = makeMockDb({ insertRows: [link] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).createLink({
      title: "Engineering Docs",
      url: "https://docs.example.com",
    });
    expect(result).toMatchObject({ id: LINK_ID, title: "Engineering Docs" });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("throws FORBIDDEN when role is member", async () => {
    const db = makeMockDb({ insertRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], role: "member" });
    await expect(
      caller(ctx).createLink({ title: "Docs", url: "https://docs.example.com" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---------------------------------------------------------------------------
// hub.deleteLink
// ---------------------------------------------------------------------------
describe("hub.deleteLink", () => {
  it("returns success when link is deleted", async () => {
    const link = makeLink();
    const db = makeMockDb({ deleteRows: [link] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).deleteLink({ id: LINK_ID });
    expect(result).toEqual({ success: true });
  });

  it("throws NOT_FOUND when link does not exist", async () => {
    const db = makeMockDb({ deleteRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(caller(ctx).deleteLink({ id: LINK_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// hub.listIntegrations
// ---------------------------------------------------------------------------
describe("hub.listIntegrations", () => {
  it("returns 3 available services with connected false when none stored", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).listIntegrations();
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.connected === false)).toBe(true);
  });

  it("marks slack as connected when a slack integration exists", async () => {
    const slackIntegration = makeIntegration({ service: "slack" });
    const db = makeMockDb({ selectRows: [slackIntegration] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).listIntegrations();
    const slack = result.find((s) => s.service === "slack");
    expect(slack?.connected).toBe(true);
    const github = result.find((s) => s.service === "github");
    expect(github?.connected).toBe(false);
  });

  it("returns services with correct labels", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).listIntegrations();
    const services = result.map((s) => s.service);
    expect(services).toContain("slack");
    expect(services).toContain("google-drive");
    expect(services).toContain("github");
  });

  it("throws UNAUTHORIZED when tenantId is null", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"], tenantId: null });
    await expect(caller(ctx).listIntegrations()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---------------------------------------------------------------------------
// hub.storeOAuthToken (replaces connectIntegration — now stores real tokens)
// ---------------------------------------------------------------------------
describe("hub.storeOAuthToken", () => {
  it("inserts a new integration when not already connected", async () => {
    const integration = makeIntegration();
    const db = makeMockDb({
      selectSequence: [[]],
      insertRows: [integration],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).storeOAuthToken({
      service: "slack",
      accessToken: "xoxb-test",
    });
    expect(result).toMatchObject({ service: "slack", tenantId: TENANT_ID });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("updates connectedAt when integration already exists", async () => {
    const existing = makeIntegration();
    const updated = makeIntegration({ connectedAt: new Date() });
    const db = makeMockDb({
      selectSequence: [[existing]],
      updateRows: [updated],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).storeOAuthToken({
      service: "slack",
      accessToken: "xoxb-test",
    });
    expect(result).toMatchObject({ service: "slack" });
    expect(db.update).toHaveBeenCalledOnce();
    expect(db.insert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// hub.disconnectIntegration
// ---------------------------------------------------------------------------
describe("hub.disconnectIntegration", () => {
  it("returns success after deleting integration", async () => {
    const db = makeMockDb({ deleteRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).disconnectIntegration({ service: "slack" });
    expect(result).toEqual({ success: true });
    expect(db.delete).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// hub.reorderLinks
// ---------------------------------------------------------------------------
describe("hub.reorderLinks", () => {
  it("returns count of updated links", async () => {
    const db = makeMockDb({ updateRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).reorderLinks({
      updates: [
        { id: LINK_ID, position: 0 },
        { id: "00000000-0000-0000-0000-000000000099", position: 1 },
      ],
    });
    expect(result).toEqual({ updated: 2 });
  });
});
