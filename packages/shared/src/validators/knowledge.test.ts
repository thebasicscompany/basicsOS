import { describe, it, expect } from "vitest";
import {
  createKnowledgeDocumentSchema,
  updateKnowledgeDocumentSchema,
  reorderKnowledgeDocumentsSchema,
} from "./knowledge.js";

const VALID_UUID = "00000000-0000-0000-0000-000000000001";

describe("createKnowledgeDocumentSchema", () => {
  it("accepts minimal valid input", () => {
    const result = createKnowledgeDocumentSchema.safeParse({ title: "Onboarding Guide" });
    expect(result.success).toBe(true);
  });

  it("defaults position to 0", () => {
    const result = createKnowledgeDocumentSchema.safeParse({ title: "Guide" });
    if (result.success) expect(result.data.position).toBe(0);
  });

  it("accepts optional parentId", () => {
    const result = createKnowledgeDocumentSchema.safeParse({
      title: "Sub-page",
      parentId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(createKnowledgeDocumentSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects title over 512 characters", () => {
    expect(
      createKnowledgeDocumentSchema.safeParse({ title: "x".repeat(513) }).success,
    ).toBe(false);
  });

  it("rejects invalid parentId", () => {
    expect(
      createKnowledgeDocumentSchema.safeParse({ title: "Test", parentId: "bad" }).success,
    ).toBe(false);
  });

  it("rejects missing title", () => {
    expect(createKnowledgeDocumentSchema.safeParse({}).success).toBe(false);
  });
});

describe("updateKnowledgeDocumentSchema", () => {
  it("accepts valid update with id", () => {
    const result = updateKnowledgeDocumentSchema.safeParse({
      id: VALID_UUID,
      title: "Updated Title",
    });
    expect(result.success).toBe(true);
  });

  it("accepts update with only id (other fields optional)", () => {
    const result = updateKnowledgeDocumentSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("accepts contentJson update", () => {
    const result = updateKnowledgeDocumentSchema.safeParse({
      id: VALID_UUID,
      contentJson: { type: "doc", content: [] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    expect(
      updateKnowledgeDocumentSchema.safeParse({ title: "No ID" }).success,
    ).toBe(false);
  });

  it("rejects invalid id", () => {
    expect(
      updateKnowledgeDocumentSchema.safeParse({ id: "not-uuid" }).success,
    ).toBe(false);
  });

  it("rejects empty title when provided", () => {
    expect(
      updateKnowledgeDocumentSchema.safeParse({ id: VALID_UUID, title: "" }).success,
    ).toBe(false);
  });

  it("rejects negative position", () => {
    expect(
      updateKnowledgeDocumentSchema.safeParse({ id: VALID_UUID, position: -1 }).success,
    ).toBe(false);
  });
});

describe("reorderKnowledgeDocumentsSchema", () => {
  it("accepts valid reorder input", () => {
    const result = reorderKnowledgeDocumentsSchema.safeParse({
      updates: [
        { id: VALID_UUID, position: 0 },
        { id: "00000000-0000-0000-0000-000000000002", position: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty updates array", () => {
    const result = reorderKnowledgeDocumentsSchema.safeParse({ updates: [] });
    expect(result.success).toBe(true);
  });

  it("rejects missing updates field", () => {
    expect(reorderKnowledgeDocumentsSchema.safeParse({}).success).toBe(false);
  });

  it("rejects invalid id in updates", () => {
    expect(
      reorderKnowledgeDocumentsSchema.safeParse({
        updates: [{ id: "bad", position: 0 }],
      }).success,
    ).toBe(false);
  });

  it("rejects negative position in updates", () => {
    expect(
      reorderKnowledgeDocumentsSchema.safeParse({
        updates: [{ id: VALID_UUID, position: -1 }],
      }).success,
    ).toBe(false);
  });
});
