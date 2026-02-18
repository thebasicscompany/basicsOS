import { describe, it, expect } from "vitest";
import { triggerConfigSchema, insertAutomationSchema } from "./automations.js";

describe("triggerConfigSchema", () => {
  it("validates a valid trigger config", () => {
    const result = triggerConfigSchema.safeParse({
      eventType: "crm.deal.stage_changed",
      conditions: [{ field: "stage", operator: "eq", value: "won" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-primitive condition value", () => {
    const result = triggerConfigSchema.safeParse({
      eventType: "crm.deal.stage_changed",
      conditions: [{ field: "stage", operator: "eq", value: { nested: "object" } }],
    });
    expect(result.success).toBe(false);
  });

  it("defaults conditions to empty array", () => {
    const result = triggerConfigSchema.safeParse({ eventType: "task.completed" });
    if (result.success) expect(result.data.conditions).toEqual([]);
  });
});

describe("insertAutomationSchema", () => {
  it("validates a full automation", () => {
    const result = insertAutomationSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      name: "Lead Follow-up",
      triggerConfig: { eventType: "crm.deal.created" },
      actionChain: [{ type: "send_email", config: { to: "{{contact.email}}" } }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown action type", () => {
    const result = insertAutomationSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      name: "Bad",
      triggerConfig: { eventType: "x" },
      actionChain: [{ type: "send_sms", config: {} }],
    });
    expect(result.success).toBe(false);
  });
});
