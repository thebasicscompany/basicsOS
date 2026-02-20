import { describe, it, expect, vi } from "vitest";
import { TRPCError, initTRPC } from "@trpc/server";
import { protectedProcedure, adminProcedure, memberProcedure, router } from "./trpc.js";
import type { TRPCContext } from "./context.js";

// Minimal mock db — procedures do not query DB in these tests
const mockDb = {} as TRPCContext["db"];

const buildCtx = (overrides: Partial<TRPCContext> = {}): TRPCContext => ({
  db: mockDb,
  userId: null,
  tenantId: null,
  role: null,
  sessionId: null,
  headers: new Headers(),
  ...overrides,
});

const testRouter = router({
  whoami: protectedProcedure.query(({ ctx }) => ({ userId: ctx.userId })),
  adminOnly: adminProcedure.query(() => "admin-data"),
  memberOnly: memberProcedure.query(() => "member-data"),
});

const callProcedure = async (path: keyof typeof testRouter._def.procedures, ctx: TRPCContext) => {
  const caller = testRouter.createCaller(ctx);
  return caller[path]();
};

describe("protectedProcedure", () => {
  it("throws UNAUTHORIZED when userId is null", async () => {
    await expect(callProcedure("whoami", buildCtx())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("succeeds for authenticated user", async () => {
    const ctx = buildCtx({ userId: "user-1", role: "member", sessionId: "s-1" });
    const result = await callProcedure("whoami", ctx);
    expect(result).toEqual({ userId: "user-1" });
  });
});

const tenantCtx = (role: "admin" | "member" | "viewer") =>
  buildCtx({ userId: "u", tenantId: "tenant-1", role, sessionId: "s" });

describe("adminProcedure", () => {
  it("throws UNAUTHORIZED when tenantId is missing", async () => {
    const ctx = buildCtx({ userId: "u", role: "admin", sessionId: "s" });
    await expect(callProcedure("adminOnly", ctx)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("throws FORBIDDEN for member role", async () => {
    await expect(callProcedure("adminOnly", tenantCtx("member"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws FORBIDDEN for viewer role", async () => {
    await expect(callProcedure("adminOnly", tenantCtx("viewer"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("succeeds for admin role", async () => {
    const result = await callProcedure("adminOnly", tenantCtx("admin"));
    expect(result).toBe("admin-data");
  });
});

describe("memberProcedure", () => {
  it("throws FORBIDDEN for viewer role", async () => {
    await expect(callProcedure("memberOnly", tenantCtx("viewer"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("succeeds for member role", async () => {
    const result = await callProcedure("memberOnly", tenantCtx("member"));
    expect(result).toBe("member-data");
  });

  it("succeeds for admin role", async () => {
    const result = await callProcedure("memberOnly", tenantCtx("admin"));
    expect(result).toBe("member-data");
  });
});
