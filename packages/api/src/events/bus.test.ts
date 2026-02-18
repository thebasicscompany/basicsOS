import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus, createEvent } from "./bus.js";

beforeEach(() => {
  EventBus.removeAllListeners();
});

describe("EventBus.emit", () => {
  it("dispatches event to registered subscriber", async () => {
    const handler = vi.fn();
    EventBus.on("task.completed" as const, handler);

    const event = createEvent({
      type: "task.completed",
      tenantId: "00000000-0000-0000-0000-000000000001",
      payload: { taskId: "00000000-0000-0000-0000-000000000002" },
    });

    EventBus.emit(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("does not call unregistered subscribers", () => {
    const handler = vi.fn();
    EventBus.on("task.assigned" as const, handler);

    const event = createEvent({
      type: "task.completed",
      tenantId: "00000000-0000-0000-0000-000000000001",
      payload: { taskId: "00000000-0000-0000-0000-000000000002" },
    });

    EventBus.emit(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it("dispatches to multiple subscribers for the same event type", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    EventBus.on("document.created" as const, handler1);
    EventBus.on("document.created" as const, handler2);

    const event = createEvent({
      type: "document.created",
      tenantId: "00000000-0000-0000-0000-000000000001",
      payload: { documentId: "00000000-0000-0000-0000-000000000002" },
    });

    EventBus.emit(event);
    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });
});

describe("createEvent", () => {
  it("generates a unique id for each event", () => {
    const e1 = createEvent({
      type: "task.created",
      tenantId: "t1",
      payload: { taskId: "x" },
    });
    const e2 = createEvent({
      type: "task.created",
      tenantId: "t1",
      payload: { taskId: "x" },
    });
    expect(e1.id).not.toBe(e2.id);
  });

  it("sets createdAt to a recent date", () => {
    const before = Date.now();
    const event = createEvent({
      type: "task.created",
      tenantId: "t1",
      payload: { taskId: "x" },
    });
    expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
