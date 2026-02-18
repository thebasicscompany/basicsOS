import { describe, it, expect } from "vitest";
import { moduleManifestSchema } from "./module.js";

const validManifest = {
  name: "inventory",
  displayName: "Inventory",
  description: "Track physical goods and stock levels",
  icon: "📦",
  defaultFields: [
    { name: "sku", type: "text" as const, required: true },
    { name: "quantity", type: "number" as const, required: false },
  ],
  activeByDefault: false,
  platforms: ["web" as const, "desktop" as const],
  hasMCPTool: false,
};

describe("moduleManifestSchema", () => {
  it("validates a valid manifest", () => {
    const result = moduleManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it("rejects invalid name format — uppercase letters", () => {
    const result = moduleManifestSchema.safeParse({
      ...validManifest,
      name: "Inventory",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid name format — starts with number", () => {
    const result = moduleManifestSchema.safeParse({
      ...validManifest,
      name: "1inventory",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid name format — spaces not allowed", () => {
    const result = moduleManifestSchema.safeParse({
      ...validManifest,
      name: "my module",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid hyphenated name", () => {
    const result = moduleManifestSchema.safeParse({
      ...validManifest,
      name: "my-module",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty displayName", () => {
    const result = moduleManifestSchema.safeParse({
      ...validManifest,
      displayName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects displayName longer than 50 characters", () => {
    const result = moduleManifestSchema.safeParse({
      ...validManifest,
      displayName: "A".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = moduleManifestSchema.safeParse({
      ...validManifest,
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("defaults platforms to web when omitted", () => {
    const { platforms: _, ...withoutPlatforms } = validManifest;
    const result = moduleManifestSchema.safeParse(withoutPlatforms);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platforms).toEqual(["web"]);
    }
  });

  it("defaults activeByDefault to false when omitted", () => {
    const { activeByDefault: _, ...withoutActive } = validManifest;
    const result = moduleManifestSchema.safeParse(withoutActive);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeByDefault).toBe(false);
    }
  });

  it("rejects invalid platform value", () => {
    const result = moduleManifestSchema.safeParse({
      ...validManifest,
      platforms: ["web", "ios"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid field type", () => {
    const result = moduleManifestSchema.safeParse({
      ...validManifest,
      defaultFields: [{ name: "col", type: "varchar" }],
    });
    expect(result.success).toBe(false);
  });
});
