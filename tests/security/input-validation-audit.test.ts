import { describe, it, expect } from "vitest";
import {
  insertTenantSchema,
  insertUserSchema,
  insertTaskSchema,
  insertDealSchema,
  insertAutomationSchema,
  moduleManifestSchema,
} from "@basicsos/shared";

describe("Input Validation Audit", () => {
  it("insertTenantSchema rejects empty name", () => {
    expect(insertTenantSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("insertUserSchema rejects invalid email", () => {
    expect(
      insertUserSchema.safeParse({
        tenantId: "00000000-0000-0000-0000-000000000001",
        email: "not-an-email",
        name: "Test",
        role: "member",
      }).success,
    ).toBe(false);
  });

  it("insertUserSchema rejects invalid role", () => {
    expect(
      insertUserSchema.safeParse({
        tenantId: "00000000-0000-0000-0000-000000000001",
        email: "test@example.com",
        name: "Test",
        role: "superadmin",
      }).success,
    ).toBe(false);
  });

  it("insertTaskSchema rejects invalid priority", () => {
    expect(
      insertTaskSchema.safeParse({
        tenantId: "00000000-0000-0000-0000-000000000001",
        title: "Test",
        createdBy: "00000000-0000-0000-0000-000000000002",
        priority: "critical",
      }).success,
    ).toBe(false);
  });

  it("insertDealSchema rejects probability > 100", () => {
    expect(
      insertDealSchema.safeParse({
        tenantId: "00000000-0000-0000-0000-000000000001",
        title: "Big Deal",
        createdBy: "00000000-0000-0000-0000-000000000002",
        probability: 150,
      }).success,
    ).toBe(false);
  });

  it("insertAutomationSchema requires non-empty name", () => {
    expect(
      insertAutomationSchema.safeParse({
        tenantId: "00000000-0000-0000-0000-000000000001",
        name: "",
        triggerConfig: { eventType: "task.completed" },
        actionChain: [],
      }).success,
    ).toBe(false);
  });

  it("moduleManifestSchema rejects uppercase name", () => {
    expect(
      moduleManifestSchema.safeParse({
        name: "MyModule",
        displayName: "My Module",
        description: "Test",
        icon: "📦",
        defaultFields: [],
        activeByDefault: false,
        platforms: ["web"],
        hasMCPTool: false,
      }).success,
    ).toBe(false);
  });

  it("moduleManifestSchema rejects empty description", () => {
    expect(
      moduleManifestSchema.safeParse({
        name: "inventory",
        displayName: "Inventory",
        description: "",
        icon: "📦",
        defaultFields: [],
        activeByDefault: false,
        platforms: ["web"],
        hasMCPTool: false,
      }).success,
    ).toBe(false);
  });
});
