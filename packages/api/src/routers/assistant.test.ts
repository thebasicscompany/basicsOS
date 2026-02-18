import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "../context.js";

vi.mock("../lib/rag.js", () => ({
  ragChat: vi.fn().mockResolvedValue({
    answer: "Test answer",
    sources: [],
    finishReason: "stop",
  }),
}));
vi.mock("@basicsos/db", () => ({ db: {} }));

import { assistantRouter } from "./assistant.js";
import { ragChat } from "../lib/rag.js";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";

const buildCtx = (overrides: Partial<TRPCContext> = {}): TRPCContext => ({
  db: {} as TRPCContext["db"],
  userId: USER_ID,
  tenantId: TENANT_ID,
  role: "member",
  sessionId: "s-1",
  headers: new Headers(),
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe("assistant.chat", () => {
  it("returns ragChat result", async () => {
    const caller = assistantRouter.createCaller(buildCtx());
    const result = await caller.chat({ message: "hello", history: [] });
    expect(result.answer).toBe("Test answer");
    expect(result.sources).toHaveLength(0);
  });

  it("calls ragChat with message, tenantId, and history", async () => {
    const caller = assistantRouter.createCaller(buildCtx());
    const history = [{ role: "user" as const, content: "prior" }];
    await caller.chat({ message: "follow-up", history });
    expect(ragChat).toHaveBeenCalledWith("follow-up", TENANT_ID, history);
  });

  it("throws UNAUTHORIZED when tenantId is null", async () => {
    const caller = assistantRouter.createCaller(buildCtx({ tenantId: null }));
    await expect(caller.chat({ message: "hi", history: [] })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects empty message", async () => {
    const caller = assistantRouter.createCaller(buildCtx());
    await expect(caller.chat({ message: "", history: [] })).rejects.toThrow();
  });
});
