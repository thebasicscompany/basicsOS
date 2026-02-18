import { describe, it, expect } from "vitest";
import { insertTaskSchema, updateTaskSchema } from "./tasks.js";

describe("insertTaskSchema", () => {
  it("validates a minimal task", () => {
    const result = insertTaskSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      title: "Fix bug",
      createdBy: "00000000-0000-0000-0000-000000000002",
    });
    expect(result.success).toBe(true);
  });

  it("defaults status to todo", () => {
    const result = insertTaskSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      title: "Fix bug",
      createdBy: "00000000-0000-0000-0000-000000000002",
    });
    if (result.success) expect(result.data.status).toBe("todo");
  });

  it("rejects invalid status", () => {
    const result = insertTaskSchema.safeParse({
      tenantId: "00000000-0000-0000-0000-000000000001",
      title: "Fix bug",
      createdBy: "00000000-0000-0000-0000-000000000002",
      status: "blocked",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  it("allows partial updates", () => {
    const result = updateTaskSchema.safeParse({ status: "done" });
    expect(result.success).toBe(true);
  });
});
