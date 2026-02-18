import { describe, it, expect } from "vitest";
import { insertContactSchema, insertDealSchema, insertDealActivitySchema } from "./crm.js";

describe("insertContactSchema", () => {
  it("validates a valid contact", () => {
    const result = insertContactSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      name: "Jane Doe",
      email: "jane@example.com",
      createdBy: "00000000-0000-0000-0000-000000000002",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = insertContactSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      name: "Jane",
      email: "not-an-email",
      createdBy: "00000000-0000-0000-0000-000000000002",
    });
    expect(result.success).toBe(false);
  });
});

describe("insertDealSchema", () => {
  it("defaults stage to lead", () => {
    const result = insertDealSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      title: "Big Deal",
      createdBy: "00000000-0000-0000-0000-000000000002",
    });
    if (result.success) expect(result.data.stage).toBe("lead");
  });

  it("rejects probability > 100", () => {
    const result = insertDealSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      title: "Big Deal",
      probability: 150,
      createdBy: "00000000-0000-0000-0000-000000000002",
    });
    expect(result.success).toBe(false);
  });
});

describe("insertDealActivitySchema", () => {
  it("validates a note activity", () => {
    const result = insertDealActivitySchema.safeParse({
      dealId: "00000000-0000-0000-0000-000000000001",
      type: "note",
      content: "Called the client",
      createdBy: "00000000-0000-0000-0000-000000000002",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown activity type", () => {
    const result = insertDealActivitySchema.safeParse({
      dealId: "00000000-0000-0000-0000-000000000001",
      type: "sms",
      content: "Hi",
      createdBy: "00000000-0000-0000-0000-000000000002",
    });
    expect(result.success).toBe(false);
  });
});
