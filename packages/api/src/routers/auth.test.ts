import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { TRPCContext } from "../context.js";

// ---------------------------------------------------------------------------
// Mock @basicsos/db
// ---------------------------------------------------------------------------
vi.mock("@basicsos/db", () => {
  const invites = {
    id: "id",
    tenantId: "tenantId",
    email: "email",
    role: "role",
    token: "token",
    acceptedAt: "acceptedAt",
    expiresAt: "expiresAt",
    createdAt: "createdAt",
  };
  return {
    invites,
    db: {},
    users: { id: "id", name: "name", email: "email", role: "role", tenantId: "tenantId", onboardedAt: "onboardedAt", createdAt: "createdAt" },
    sessions: { id: "id", userId: "userId", token: "token", expiresAt: "expiresAt" },
    accounts: { id: "id", userId: "userId", providerId: "providerId", accountId: "accountId" },
    verifications: { id: "id", identifier: "identifier", value: "value", expiresAt: "expiresAt" },
    tenants: { id: "id", name: "name", slug: "slug", createdAt: "createdAt" },
  };
});

vi.mock("../lib/email.js", () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

import { authRouter } from "./auth.js";
import { sendInviteEmail } from "../lib/email.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const INVITE_ID = "00000000-0000-0000-0000-000000000003";
const TOKEN = "00000000-0000-0000-0000-000000000099";

// ---------------------------------------------------------------------------
// Chain factory (same pattern as tasks.test.ts)
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

const makeMockDb = (
  opts: {
    selectRows?: unknown[];
    insertRows?: unknown[];
    selectSequence?: unknown[][];
  } = {},
) => {
  const insertRows = opts.insertRows ?? [];
  const selectSequence = opts.selectSequence;
  const defaultSelectRows = opts.selectRows ?? [];
  let selectCallCount = 0;

  const db = {
    select: vi.fn().mockImplementation(() => {
      const rows = selectSequence ? (selectSequence[selectCallCount++] ?? []) : defaultSelectRows;
      return makeChain(rows);
    }),
    insert: vi.fn().mockReturnValue(makeChain(insertRows)),
    update: vi.fn().mockReturnValue(makeChain([])),
    delete: vi.fn().mockReturnValue(makeChain([])),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(),
  };

  db.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));

  return db;
};

// ---------------------------------------------------------------------------
// Context builders
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

const caller = (ctx: TRPCContext) => authRouter.createCaller(ctx);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// auth.me
// ---------------------------------------------------------------------------
describe("auth.me", () => {
  it("returns current user info with tenant name and accent color", async () => {
    const db = makeMockDb({ selectRows: [{ name: "Acme Corp", accentColor: "#ff5500" }] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await caller(ctx).me();
    expect(result).toEqual({
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "admin",
      tenantName: "Acme Corp",
      accentColor: "#ff5500",
    });
  });

  it("returns null tenantId, tenantName, and accentColor when not in a tenant context", async () => {
    const ctx = buildCtx({ tenantId: null });
    const result = await caller(ctx).me();
    expect(result.tenantId).toBeNull();
    expect(result.tenantName).toBeNull();
    expect(result.accentColor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// auth.sendInvite
// ---------------------------------------------------------------------------
describe("auth.sendInvite", () => {
  it("creates an invite and sends email", async () => {
    const invite = { id: INVITE_ID, email: "new@example.com", role: "member", token: TOKEN };
    const db = makeMockDb({
      selectRows: [], // no existing invite
      insertRows: [invite],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).sendInvite({ email: "new@example.com" });

    expect(result).toMatchObject({ inviteId: INVITE_ID });
    expect(db.insert).toHaveBeenCalledOnce();
    expect(sendInviteEmail).toHaveBeenCalledOnce();
  });

  it("throws CONFLICT when a pending invite already exists", async () => {
    const db = makeMockDb({
      selectRows: [{ id: INVITE_ID }], // existing pending invite
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    await expect(caller(ctx).sendInvite({ email: "existing@example.com" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("does not fail the mutation when email delivery fails", async () => {
    (sendInviteEmail as Mock).mockRejectedValueOnce(new Error("SMTP down"));
    const invite = { id: INVITE_ID, email: "new@example.com", role: "member", token: TOKEN };
    const db = makeMockDb({
      selectRows: [],
      insertRows: [invite],
    });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    const result = await caller(ctx).sendInvite({ email: "new@example.com" });
    expect(result).toMatchObject({ inviteId: INVITE_ID });
  });
});

// ---------------------------------------------------------------------------
// auth.validateInvite
// ---------------------------------------------------------------------------
describe("auth.validateInvite", () => {
  it("returns invite details for a valid token", async () => {
    const invite = {
      email: "user@example.com",
      role: "member",
      tenantId: TENANT_ID,
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 86400000), // expires tomorrow
    };
    const db = makeMockDb({ selectRows: [invite] });
    // validateInvite is a publicProcedure, so no auth needed, but we still need a context
    const ctx = buildCtx({
      db: db as unknown as TRPCContext["db"],
      userId: null,
      tenantId: null,
      role: null,
      sessionId: null,
    });

    const result = await caller(ctx).validateInvite({ token: TOKEN });
    expect(result).toMatchObject({
      email: "user@example.com",
      role: "member",
      tenantId: TENANT_ID,
    });
  });

  it("throws NOT_FOUND for unknown token", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({
      db: db as unknown as TRPCContext["db"],
      userId: null,
      tenantId: null,
      role: null,
      sessionId: null,
    });

    await expect(caller(ctx).validateInvite({ token: "bad-token" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws CONFLICT for already-used invite", async () => {
    const invite = {
      email: "user@example.com",
      role: "member",
      tenantId: TENANT_ID,
      acceptedAt: new Date(), // already accepted
      expiresAt: new Date(Date.now() + 86400000),
    };
    const db = makeMockDb({ selectRows: [invite] });
    const ctx = buildCtx({
      db: db as unknown as TRPCContext["db"],
      userId: null,
      tenantId: null,
      role: null,
      sessionId: null,
    });

    await expect(caller(ctx).validateInvite({ token: TOKEN })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("throws FORBIDDEN for expired invite", async () => {
    const invite = {
      email: "user@example.com",
      role: "member",
      tenantId: TENANT_ID,
      acceptedAt: null,
      expiresAt: new Date(Date.now() - 86400000), // expired yesterday
    };
    const db = makeMockDb({ selectRows: [invite] });
    const ctx = buildCtx({
      db: db as unknown as TRPCContext["db"],
      userId: null,
      tenantId: null,
      role: null,
      sessionId: null,
    });

    await expect(caller(ctx).validateInvite({ token: TOKEN })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
