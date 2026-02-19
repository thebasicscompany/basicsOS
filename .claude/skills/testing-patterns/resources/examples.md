# Testing Examples — Basics OS

## Vitest + Drizzle Mock Pattern

All API router tests use this pattern. The key insight: Drizzle query chains are **thenable** objects — they act as both a Promise and a chainable builder.

### 1. Thenable Chain Factory (`makeChain`)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Drizzle chains: db.select().from(table).where(...).orderBy(...)
 * Terminal calls resolve to rows. All methods return `this` for chaining.
 */
const makeChain = (rows: unknown[]) => {
  const promise = Promise.resolve(rows);
  const chain: Record<string, unknown> = {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  for (const method of ["from", "where", "set", "values", "orderBy", "returning"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  return chain;
};
```

### 2. DB Mock Builder (`makeMockDb`)

Supports multiple sequential `select()` calls via `selectSequence` (e.g., when a procedure does a lookup then a list query).

```ts
const makeMockDb = (opts: {
  selectRows?: unknown[];
  insertRows?: unknown[];
  updateRows?: unknown[];
  deleteRows?: unknown[];
  selectSequence?: unknown[][];
} = {}) => {
  const insertRows = opts.insertRows ?? [];
  const updateRows = opts.updateRows ?? [];
  const deleteRows = opts.deleteRows ?? [];
  const selectSequence = opts.selectSequence;
  const defaultSelectRows = opts.selectRows ?? [];

  let selectCallIndex = 0;

  return {
    select: vi.fn().mockImplementation(() => {
      if (selectSequence && selectCallIndex < selectSequence.length) {
        return makeChain(selectSequence[selectCallIndex++]!);
      }
      return makeChain(defaultSelectRows);
    }),
    insert: vi.fn().mockReturnValue(makeChain(insertRows)),
    update: vi.fn().mockReturnValue(makeChain(updateRows)),
    delete: vi.fn().mockReturnValue(makeChain(deleteRows)),
  };
};
```

### 3. Context Builder (`buildCtx`)

```ts
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID   = "00000000-0000-0000-0000-000000000002";

const buildCtx = (dbOverrides = {}): TRPCContext => ({
  userId: USER_ID,
  tenantId: TENANT_ID,
  role: "admin",
  db: makeMockDb(dbOverrides) as unknown as TRPCContext["db"],
});
```

### 4. Full Router Test Example

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "../context.js";
import { EventBus } from "../events/bus.js";

// Mock the DB module BEFORE importing the router
vi.mock("@basicsos/db", () => {
  const tasks = {
    id: "id", tenantId: "tenantId", status: "status",
    priority: "priority", assigneeId: "assigneeId",
    createdAt: "createdAt", updatedAt: "updatedAt",
  };
  return { tasks, db: {} };
});

import { tasksRouter } from "./tasks.js";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID   = "00000000-0000-0000-0000-000000000002";
const TASK_ID   = "00000000-0000-0000-0000-000000000003";

const caller = (ctx: TRPCContext) => tasksRouter.createCaller(ctx);

describe("tasks router", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("list returns tasks for tenant", async () => {
    const mockTask = { id: TASK_ID, tenantId: TENANT_ID, title: "Test" };
    const ctx = buildCtx({ selectRows: [mockTask] });

    const result = await caller(ctx).list({});
    expect(result).toEqual([mockTask]);
  });

  it("create inserts task and emits event", async () => {
    const created = { id: TASK_ID, tenantId: TENANT_ID, title: "New" };
    const ctx = buildCtx({ insertRows: [created] });
    const handler = vi.fn();
    EventBus.on("task.created", handler);

    const result = await caller(ctx).create({ title: "New" });

    expect(result).toEqual(created);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "task.created", tenantId: TENANT_ID }),
    );
    EventBus.removeListener("task.created", handler);
  });
});
```

### 5. Multi-Query Test (selectSequence)

When a procedure makes multiple `db.select()` calls (e.g., check existence then fetch related):

```ts
it("update fetches existing then updates", async () => {
  const existing = { id: TASK_ID, tenantId: TENANT_ID, title: "Old" };
  const updated  = { id: TASK_ID, tenantId: TENANT_ID, title: "New" };

  // First select() returns existing row, second returns updated row
  const ctx = buildCtx({
    selectSequence: [[existing]],
    updateRows: [updated],
  });

  const result = await caller(ctx).update({ id: TASK_ID, title: "New" });
  expect(result).toEqual(updated);
});
```

### 6. Testing LLM Calls

Mock `chatCompletion` with the 2-param signature (opts, telemetry?):

```ts
vi.mock("../lib/llm-client.js", () => ({
  chatCompletion: vi.fn().mockResolvedValue({
    content: "AI response",
    model: "claude-sonnet-4-6",
    usage: { promptTokens: 10, completionTokens: 20 },
  }),
}));
```
