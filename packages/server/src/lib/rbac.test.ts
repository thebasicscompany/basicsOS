import { describe, expect, it } from "vitest";
import { hasPermission, wouldRemoveLastManager } from "./rbac.js";

describe("hasPermission", () => {
  it("returns true for exact permission", () => {
    expect(hasPermission(new Set(["records.read"]), "records.read")).toBe(true);
  });

  it("returns true for wildcard", () => {
    expect(hasPermission(new Set(["*"]), "records.delete.hard")).toBe(true);
  });

  it("returns false when missing", () => {
    expect(hasPermission(new Set(["records.read"]), "rbac.manage")).toBe(false);
  });
});

describe("wouldRemoveLastManager", () => {
  it("blocks when removing manage permission from last manager", () => {
    expect(
      wouldRemoveLastManager({
        targetHadManagePermission: true,
        newRoleHasManagePermission: false,
        currentManagerCount: 1,
      })
    ).toBe(true);
  });

  it("allows removal when at least one other manager exists", () => {
    expect(
      wouldRemoveLastManager({
        targetHadManagePermission: true,
        newRoleHasManagePermission: false,
        currentManagerCount: 2,
      })
    ).toBe(false);
  });

  it("allows updates that keep manage permission", () => {
    expect(
      wouldRemoveLastManager({
        targetHadManagePermission: true,
        newRoleHasManagePermission: true,
        currentManagerCount: 1,
      })
    ).toBe(false);
  });
});
