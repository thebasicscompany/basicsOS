import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "../context.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@basicsos/db", () => ({ db: {} }));

const mockSemanticSearch = vi.fn();
vi.mock("../lib/semantic-search.js", () => ({
  semanticSearch: (...args: unknown[]) => mockSemanticSearch(...args),
}));

import { searchRouter } from "./search.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";

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

const caller = (ctx: TRPCContext) => searchRouter.createCaller(ctx);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// search.semantic
// ---------------------------------------------------------------------------
describe("search.semantic", () => {
  it("returns results from semanticSearch", async () => {
    const results = [
      { sourceType: "document", sourceId: "d1", chunkText: "hello", score: 0.9 },
    ];
    mockSemanticSearch.mockResolvedValue(results);
    const ctx = buildCtx();

    const result = await caller(ctx).semantic({ query: "hello" });

    expect(result).toEqual(results);
    expect(mockSemanticSearch).toHaveBeenCalledWith("hello", TENANT_ID, 10);
  });

  it("passes custom limit to semanticSearch", async () => {
    mockSemanticSearch.mockResolvedValue([]);
    const ctx = buildCtx();

    await caller(ctx).semantic({ query: "test", limit: 5 });

    expect(mockSemanticSearch).toHaveBeenCalledWith("test", TENANT_ID, 5);
  });

  it("returns empty array when no results", async () => {
    mockSemanticSearch.mockResolvedValue([]);
    const ctx = buildCtx();

    const result = await caller(ctx).semantic({ query: "nothing" });

    expect(result).toEqual([]);
  });

  it("throws UNAUTHORIZED when tenantId is null", async () => {
    const ctx = buildCtx({ tenantId: null });

    await expect(
      caller(ctx).semantic({ query: "test" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
