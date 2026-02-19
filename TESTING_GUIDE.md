# Testing Guide

This guide covers how to run, write, and extend tests for Basics OS. It also documents the current state of test coverage so contributors know what exists and what still needs work.

## Quick Start

```bash
# Run all unit tests
pnpm test

# Run integration + security tests
pnpm vitest run

# Run a specific package
pnpm --filter @basicos/api test
pnpm --filter @basicos/shared test

# Run a single test file
pnpm vitest run packages/api/src/routers/tasks.test.ts

# Watch mode
pnpm --filter @basicos/api test -- --watch
```

## Test Layers

| Layer | Location | What it tests | Speed |
|-------|----------|---------------|-------|
| Unit | `packages/*/src/**/*.test.ts` | Individual functions, routers, validators | Fast (~ms) |
| Integration | `tests/e2e/` | Multi-tenant isolation across routers | Medium |
| Security | `tests/security/` | RBAC, input validation, secret scanning | Medium |
| Platform | `apps/*/src/**/*.test.ts` | MCP servers, web API routes | Fast |

All tests use **Vitest** and run without a real database — Drizzle is mocked with chainable proxies.

## Current Coverage Map (42 test files)

### API Routers — `packages/api/src/routers/`

| Router | Test file | Status |
|--------|-----------|--------|
| `tasks.ts` | `tasks.test.ts` | Covered: list, get, create, update, delete, getOverdue, events |
| `knowledge.ts` | `knowledge.test.ts` | Covered |
| `crm.ts` | `crm.test.ts` | Covered |
| `meetings.ts` | `meetings.test.ts` | Covered |
| `assistant.ts` | `assistant.test.ts` | Covered |
| `automations.ts` | `automations.test.ts` | Covered |
| `ai-employees.ts` | `ai-employees.test.ts` | Covered |
| `hub.ts` | `hub.test.ts` | Covered |
| `modules.ts` | `modules.test.ts` | Covered |
| `auth.ts` | `auth.test.ts` | Covered: me, sendInvite (duplicate check, email failure), validateInvite (expired, used, not found) |
| `search.ts` | `search.test.ts` | Covered: semantic search, custom limit, empty results, missing tenantId |

### Validators — `packages/shared/src/validators/`

| Validator | Test file | Status |
|-----------|-----------|--------|
| `tasks.ts` | `tasks.test.ts` | Covered |
| `crm.ts` | `crm.test.ts` | Covered |
| `automations.ts` | `automations.test.ts` | Covered |
| `module.ts` | `module.test.ts` | Covered |
| `tenants.ts` | `tenants.test.ts` | Covered |
| `documents.ts` | `documents.test.ts` | Covered: insert (valid, edge cases, UUID validation), update (partial) |
| `knowledge.ts` | `knowledge.test.ts` | Covered: create, update, reorder (valid inputs, edge cases) |
| `meetings.ts` | `meetings.test.ts` | Covered: insertMeeting, insertTranscript, uploadTranscript |

### Library Functions — `packages/api/src/lib/`

All 7 lib modules have tests: `rag`, `embeddings`, `llm-client`, `email`, `chunker`, `context-assembler`, `query-analyzer`.

### Other

| Area | Test files | Status |
|------|-----------|--------|
| Event bus | `bus.test.ts`, `automation-listener.test.ts` | Covered |
| PII redaction middleware | `pii-redaction.test.ts` | Covered |
| tRPC procedures | `trpc.test.ts` | Covered |
| API server setup | `server.test.ts` | Covered |
| Auth roles | `packages/auth/src/roles.test.ts` | Covered |
| Shared exports | `packages/shared/src/index.test.ts` | Covered |
| Event types | `packages/shared/src/types/events.test.ts` | Covered |
| UI utils | `packages/ui/src/lib/utils.test.ts` | Covered |
| Company MCP server | `apps/mcp/company/src/server.test.ts` | Covered |
| Engineer MCP server | `apps/mcp/engineer/src/server.test.ts` | Covered |
| Web branding route | `apps/web/src/app/api/branding/route.test.ts` | Covered |
| Multi-tenant isolation | `tests/e2e/multi-tenant-isolation.test.ts` | Covered |
| RBAC audit | `tests/security/rbac-audit.test.ts` | Covered |
| Input validation audit | `tests/security/input-validation-audit.test.ts` | Covered |
| Secrets audit | `tests/security/secrets-audit.test.ts` | Covered |

## Remaining Gaps (Contributions Welcome)

All routers and validators now have test coverage. The remaining areas where tests would add value:

1. **Worker tests** (`packages/api/src/workers/`) — BullMQ workers need queue mocking. Medium difficulty.
2. **Database migration tests** — verify that `pnpm db:migrate` applies cleanly to a fresh database.
3. **Test coverage reporting** — add `--coverage` flag to vitest in CI to track coverage percentages over time.
4. **Auth integration pages** — `apps/web/src/app/(auth)/` pages have TODO comments for Better Auth sign-in/sign-up integration. Tests should follow once those are wired up.

## How Tests Work

### Mock Database

Tests never connect to a real database. Every test file mocks `@basicsos/db` and builds a fake Drizzle client using chainable proxies:

```typescript
// Chain factory — mimics Drizzle's fluent API: .select().from().where()
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

const makeMockDb = (rows: unknown[] = []) => ({
  select: vi.fn(() => makeChain(rows)),
  insert: vi.fn(() => makeChain(rows)),
  update: vi.fn(() => makeChain(rows)),
  delete: vi.fn(() => makeChain(rows)),
});
```

The key insight: the chain object is a **thenable** (has `.then()`), so `await db.select().from(table).where(...)` resolves to `rows`.

### Test Context Builder

Every router test builds a `TRPCContext` with a mock DB, user, and tenant:

```typescript
const buildCtx = (overrides: Partial<TRPCContext> = {}): TRPCContext => ({
  db: makeMockDb([]) as unknown as TRPCContext["db"],
  userId: "00000000-0000-0000-0000-000000000001",
  tenantId: "00000000-0000-0000-0000-000000000002",
  role: "member",
  sessionId: "test-session",
  headers: new Headers(),
  ...overrides,
});
```

### Event Testing

Mutations emit events. Test them by subscribing before the call:

```typescript
const handler = vi.fn();
EventBus.on("task.created", handler);

await caller(ctx).create({ title: "Test" });

expect(handler).toHaveBeenCalledOnce();
expect(handler).toHaveBeenCalledWith(
  expect.objectContaining({
    type: "task.created",
    tenantId: TENANT_ID,
    payload: { taskId: expect.any(String) },
  }),
);
```

Always clean up in `beforeEach`:
```typescript
beforeEach(() => { EventBus.removeAllListeners(); });
```

## Writing a New Test

### 1. Co-locate with the source file

```
packages/api/src/routers/search.ts       # source
packages/api/src/routers/search.test.ts   # test — same directory
```

### 2. Mock the DB before importing

```typescript
vi.mock("@basicsos/db", () => {
  const myTable = { id: "id", tenantId: "tenantId", /* column stubs */ };
  return { myTable, db: {} };
});

// Import AFTER mocking
import { myRouter } from "./my-module.js";
```

### 3. Follow Arrange-Act-Assert

```typescript
describe("myRouter.list", () => {
  it("returns items for the tenant", async () => {
    // Arrange
    const db = makeMockDb({ selectRows: [{ id: "1", title: "Item" }] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });

    // Act
    const result = await myRouter.createCaller(ctx).list({});

    // Assert
    expect(result).toHaveLength(1);
    expect(db.select).toHaveBeenCalledOnce();
  });
});
```

### 4. Test what matters per router

| Procedure | What to verify |
|-----------|---------------|
| `list` | Returns data, respects filters, empty case |
| `get` | Returns item, throws NOT_FOUND for missing |
| `create` | Returns created item, emits event, DB insert called |
| `update` | Returns updated item, emits events on state changes, NOT_FOUND |
| `delete` | Returns success, NOT_FOUND for missing |

### 5. Test what matters per validator

```typescript
describe("insertMySchema", () => {
  it("accepts valid input", () => {
    expect(insertMySchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects missing required field", () => {
    expect(insertMySchema.safeParse({}).success).toBe(false);
  });

  it("rejects invalid enum value", () => {
    expect(insertMySchema.safeParse({ ...validInput, status: "nope" }).success).toBe(false);
  });
});
```

## Security Tests Explained

These run from the repo root via `pnpm vitest run` and verify security properties across the entire codebase.

### Multi-Tenant Isolation (`tests/e2e/multi-tenant-isolation.test.ts`)

Creates two tenants with separate mock DBs and verifies:
- Tenant A's caller only touches Tenant A's DB
- Tenant B's caller only touches Tenant B's DB
- A `null` tenantId throws `UNAUTHORIZED`

### RBAC Audit (`tests/security/rbac-audit.test.ts`)

Scans router source files to verify that write operations use `memberProcedure` or `adminProcedure`, not just `protectedProcedure`.

### Input Validation Audit (`tests/security/input-validation-audit.test.ts`)

Ensures every validator in `packages/shared/src/validators/` rejects malformed input — catches regressions where someone removes a `.min(1)` or `.email()` check.

### Secrets Audit (`tests/security/secrets-audit.test.ts`)

Scans all `.ts` files in `packages/` for hardcoded API keys matching known patterns (Anthropic, OpenAI, Deepgram, etc.). Fails the build if anyone commits a real key.

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

```
1. Install (pnpm install --frozen-lockfile)
2. Build   (shared → db → auth → ui → api)
3. Typecheck (shared, db, auth, api, web)
4. Unit tests (shared, api)
5. Integration + security tests (vitest run)
6. Dependency audit (pnpm audit --audit-level moderate)
```

### Simulate CI Locally

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm vitest run
pnpm audit --audit-level moderate
```

If all of these pass locally, CI will pass.

## Common Failures & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module @basicsos/...` | Packages not built | `pnpm build` |
| `tenantId is null` | Missing context in test | Use `buildCtx({ tenantId: "..." })` |
| `Property 'X' does not exist` | Type mismatch after schema change | `pnpm typecheck` to see full error |
| `vi.mock is not a function` | Wrong import order | Mock before importing the module under test |
| `ENOENT .env` | Missing env file | Tests don't need `.env` — check vitest.config.ts env stubs |
| Tests pass locally, fail in CI | Build order issue | CI builds in dependency order; make sure `pnpm build` passes |

## Contributor Testing Checklist

Before submitting a PR, run through this:

```bash
# 1. Typecheck
pnpm typecheck

# 2. Lint
pnpm lint

# 3. Unit tests
pnpm test

# 4. Integration + security tests
pnpm vitest run

# 5. If you changed a schema, regenerate
pnpm db:generate
```

If you added a new router or validator, make sure you also added the corresponding `.test.ts` file. The security audit tests will catch missing validators, but router tests are on you.

## OSS Readiness Assessment

### What's Solid

- **42 test files** covering all critical paths
- **All 12 routers** have dedicated tests
- **All 8 validators** have dedicated tests
- **All 7 lib modules** tested
- **4 security tests** that run in CI on every push
- **Multi-tenant isolation** verified at the router level
- **Secrets scanning** automated — catches hardcoded keys before merge
- **RBAC enforcement** audited across all write procedures
- **Event emission** tested for all state-changing mutations

### What Users Should Know

1. **Tests don't need a database.** Everything is mocked. `pnpm test` works immediately after `pnpm install && pnpm build`.
2. **Security tests run automatically.** You don't need to remember to check for leaked secrets or broken RBAC — CI does it.
3. **The setup script is tested by usage.** `pnpm dev:setup` generates `.env`, starts Docker, builds, migrates, and seeds. If it breaks, you'll know immediately.

### What Still Needs Work

| Gap | Priority | Difficulty | Notes |
|-----|----------|------------|-------|
| Worker tests | Medium | Medium | Workers depend on BullMQ — needs queue mocking |
| Database migration tests | Low | Easy | Verify `pnpm db:migrate` on a fresh DB |
| Test coverage reporting in CI | Low | Easy | Add `--coverage` flag to vitest |
| Auth page integration tests | Low | Medium | Blocked on Better Auth sign-in/sign-up wiring |

### Files That Reference This

- `CLAUDE.md` — points developers here for testing patterns
- `CONTRIBUTING.md` — tells contributors to run `pnpm test` before PRs
- `.github/workflows/ci.yml` — the CI pipeline that runs everything
- `.claude/skills/testing-patterns/` — AI agent skill for writing tests
