import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "../context.js";

vi.mock("../lib/rag.js", () => ({
  ragChat: vi.fn().mockResolvedValue({
    answer: "Test answer",
    sources: [],
    finishReason: "stop",
  }),
}));
vi.mock("@basicsos/db", () => ({
  db: {},
  users: { id: "id", name: "name", email: "email", role: "role", tenantId: "tenantId", onboardedAt: "onboardedAt", createdAt: "createdAt" },
  sessions: { id: "id", userId: "userId", token: "token", expiresAt: "expiresAt" },
  accounts: { id: "id", userId: "userId", providerId: "providerId", accountId: "accountId" },
  verifications: { id: "id", identifier: "identifier", value: "value", expiresAt: "expiresAt" },
  tenants: { id: "id", name: "name", slug: "slug", createdAt: "createdAt" },
  invites: { id: "id", tenantId: "tenantId", email: "email", role: "role", token: "token", acceptedAt: "acceptedAt", expiresAt: "expiresAt", createdAt: "createdAt" },
}));

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
    // ragChat(message, tenantId, history, userId) — userId is 4th arg
    expect(ragChat).toHaveBeenCalledWith("follow-up", TENANT_ID, history, USER_ID);
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
