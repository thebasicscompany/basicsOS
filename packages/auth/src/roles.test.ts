import { describe, it, expect } from "vitest";
import { hasRole, isAdmin, isMember, USER_ROLES } from "./roles.js";

describe("hasRole", () => {
  it("admin has all roles", () => {
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("admin", "member")).toBe(true);
    expect(hasRole("admin", "viewer")).toBe(true);
  });

  it("member does not have admin", () => {
    expect(hasRole("member", "admin")).toBe(false);
    expect(hasRole("member", "member")).toBe(true);
    expect(hasRole("member", "viewer")).toBe(true);
  });

  it("viewer only has viewer", () => {
    expect(hasRole("viewer", "admin")).toBe(false);
    expect(hasRole("viewer", "member")).toBe(false);
    expect(hasRole("viewer", "viewer")).toBe(true);
  });
});

describe("isAdmin", () => {
  it("returns true only for admin role", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("member")).toBe(false);
    expect(isAdmin("viewer")).toBe(false);
  });
});

describe("isMember", () => {
  it("returns true for member and admin", () => {
    expect(isMember("admin")).toBe(true);
    expect(isMember("member")).toBe(true);
    expect(isMember("viewer")).toBe(false);
  });
});

describe("USER_ROLES", () => {
  it("contains all three roles", () => {
    expect(USER_ROLES).toContain("admin");
    expect(USER_ROLES).toContain("member");
    expect(USER_ROLES).toContain("viewer");
  });
});
