import { describe, it, expect } from "vitest";
import type { TRPCContext } from "../context.js";
import { modulesRouter } from "./modules.js";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";

const buildCtx = (overrides: Partial<TRPCContext> = {}): TRPCContext => ({
  db: {} as TRPCContext["db"],
  userId: USER_ID,
  tenantId: TENANT_ID,
  role: "admin",
  sessionId: "session-1",
  headers: new Headers(),
  ...overrides,
});

describe("modules.list", () => {
  it("returns all 7 built-in modules", async () => {
    const caller = modulesRouter.createCaller(buildCtx());
    const result = await caller.list();
    expect(result).toHaveLength(7);
  });

  it("includes expected module names", async () => {
    const caller = modulesRouter.createCaller(buildCtx());
    const result = await caller.list();
    const names = result.map((m) => m.name);
    expect(names).toContain("knowledge");
    expect(names).toContain("crm");
    expect(names).toContain("tasks");
    expect(names).toContain("meetings");
    expect(names).toContain("hub");
    expect(names).toContain("ai-employees");
    expect(names).toContain("automations");
  });
});

describe("modules.getStatus", () => {
  it("returns module info for a known module", async () => {
    const caller = modulesRouter.createCaller(buildCtx());
    const result = await caller.getStatus({ moduleName: "crm" });
    expect(result).not.toBeNull();
    expect(result?.name).toBe("crm");
    expect(result?.displayName).toBe("CRM");
    expect(typeof result?.enabled).toBe("boolean");
  });

  it("returns null for an unknown module", async () => {
    const caller = modulesRouter.createCaller(buildCtx());
    const result = await caller.getStatus({ moduleName: "nonexistent-module" });
    expect(result).toBeNull();
  });

  it("reflects activeByDefault as the enabled flag", async () => {
    const caller = modulesRouter.createCaller(buildCtx());
    const active = await caller.getStatus({ moduleName: "tasks" });
    expect(active?.enabled).toBe(true);
    const inactive = await caller.getStatus({ moduleName: "automations" });
    expect(inactive?.enabled).toBe(false);
  });
});

describe("modules.setEnabled", () => {
  it("returns updated status when enabling a module", async () => {
    const caller = modulesRouter.createCaller(buildCtx());
    const result = await caller.setEnabled({ moduleName: "automations", enabled: true });
    expect(result).toEqual({ moduleName: "automations", enabled: true });
  });

  it("returns updated status when disabling a module", async () => {
    const caller = modulesRouter.createCaller(buildCtx());
    const result = await caller.setEnabled({ moduleName: "crm", enabled: false });
    expect(result).toEqual({ moduleName: "crm", enabled: false });
  });

  it("throws UNAUTHORIZED when tenantId is missing", async () => {
    const caller = modulesRouter.createCaller(buildCtx({ tenantId: null }));
    await expect(
      caller.setEnabled({ moduleName: "crm", enabled: false }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN for non-admin role", async () => {
    const caller = modulesRouter.createCaller(buildCtx({ role: "member" }));
    await expect(
      caller.setEnabled({ moduleName: "crm", enabled: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
