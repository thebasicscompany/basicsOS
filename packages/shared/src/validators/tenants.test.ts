import { describe, it, expect } from "vitest";
import { insertTenantSchema, insertUserSchema, insertInviteSchema } from "./tenants.js";

describe("insertTenantSchema", () => {
  it("validates a valid tenant", () => {
    const result = insertTenantSchema.safeParse({ name: "Acme", accentColor: "#6366f1" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid accent color", () => {
    const result = insertTenantSchema.safeParse({ name: "Acme", accentColor: "not-a-color" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = insertTenantSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("insertUserSchema", () => {
  it("validates a valid user", () => {
    const result = insertUserSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      email: "user@example.com",
      name: "Test User",
      role: "member",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = insertUserSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      email: "not-an-email",
      name: "Test",
      role: "member",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = insertUserSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      email: "user@example.com",
      name: "Test",
      role: "superuser",
    });
    expect(result.success).toBe(false);
  });
});

describe("insertInviteSchema", () => {
  it("defaults role to member", () => {
    const result = insertInviteSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      email: "invite@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe("member");
  });
});
