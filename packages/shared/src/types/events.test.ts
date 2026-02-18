import { describe, it, expect } from "vitest";
import { BasicsOSEventSchema } from "./events.js";

describe("BasicsOSEventSchema", () => {
  it("validates a task.completed event", () => {
    const result = BasicsOSEventSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000001",
      type: "task.completed",
      tenantId: "00000000-0000-0000-0000-000000000002",
      createdAt: new Date(),
      payload: { taskId: "00000000-0000-0000-0000-000000000003" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown event type", () => {
    const result = BasicsOSEventSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000001",
      type: "unknown.event",
      tenantId: "00000000-0000-0000-0000-000000000002",
      createdAt: new Date(),
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it("validates a crm.deal.stage_changed event with full payload", () => {
    const result = BasicsOSEventSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000001",
      type: "crm.deal.stage_changed",
      tenantId: "00000000-0000-0000-0000-000000000002",
      createdAt: new Date(),
      payload: {
        dealId: "00000000-0000-0000-0000-000000000003",
        fromStage: "lead",
        toStage: "qualified",
      },
    });
    expect(result.success).toBe(true);
  });
});
