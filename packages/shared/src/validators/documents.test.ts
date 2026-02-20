import { describe, it, expect } from "vitest";
import { insertDocumentSchema, updateDocumentSchema } from "./documents.js";

const VALID_UUID = "00000000-0000-0000-0000-000000000001";
const VALID_UUID_2 = "00000000-0000-0000-0000-000000000002";

describe("insertDocumentSchema", () => {
  const validInput = {
    tenantId: VALID_UUID,
    title: "Getting Started",
    createdBy: VALID_UUID_2,
  };

  it("accepts minimal valid input", () => {
    expect(insertDocumentSchema.safeParse(validInput).success).toBe(true);
  });

  it("defaults position to 0", () => {
    const result = insertDocumentSchema.safeParse(validInput);
    if (result.success) expect(result.data.position).toBe(0);
  });

  it("accepts optional parentId", () => {
    const result = insertDocumentSchema.safeParse({ ...validInput, parentId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("accepts optional contentJson", () => {
    const result = insertDocumentSchema.safeParse({
      ...validInput,
      contentJson: { type: "doc", content: [] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const { title, ...rest } = validInput;
    expect(insertDocumentSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty title", () => {
    expect(insertDocumentSchema.safeParse({ ...validInput, title: "" }).success).toBe(false);
  });

  it("rejects title over 512 characters", () => {
    expect(insertDocumentSchema.safeParse({ ...validInput, title: "a".repeat(513) }).success).toBe(
      false,
    );
  });

  it("rejects invalid tenantId", () => {
    expect(insertDocumentSchema.safeParse({ ...validInput, tenantId: "not-a-uuid" }).success).toBe(
      false,
    );
  });

  it("rejects invalid parentId", () => {
    expect(insertDocumentSchema.safeParse({ ...validInput, parentId: "bad" }).success).toBe(false);
  });

  it("rejects negative position", () => {
    expect(insertDocumentSchema.safeParse({ ...validInput, position: -1 }).success).toBe(false);
  });
});

describe("updateDocumentSchema", () => {
  it("allows partial updates", () => {
    expect(updateDocumentSchema.safeParse({ title: "New Title" }).success).toBe(true);
  });

  it("allows empty update (all fields optional)", () => {
    expect(updateDocumentSchema.safeParse({}).success).toBe(true);
  });

  it("rejects empty title when provided", () => {
    expect(updateDocumentSchema.safeParse({ title: "" }).success).toBe(false);
  });
});
