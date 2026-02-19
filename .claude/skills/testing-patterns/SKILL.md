---
name: testing-patterns
description: Testing conventions, patterns, and best practices for Basics OS.
---
# Testing Patterns

## When to Use This Skill
Invoke when writing or modifying tests.

## Conventions
- Test files live next to source: `feature.ts` → `feature.test.ts`
- Use descriptive test names: `it("returns null when user not found")`
- One assertion per test when possible
- Arrange-Act-Assert structure

## What to Test
- Public API surface of each module
- Edge cases and error paths
- Integration points between modules
- NOT: internal implementation details, private functions

## Mocking Rules
- Mock external dependencies (APIs, databases, file system)
- Do NOT mock internal modules — use real implementations
- Reset mocks between tests (`vi.clearAllMocks()` in `beforeEach`)

## Project-Specific Patterns

### Drizzle DB Mocking
- **`makeChain(rows)`** — creates a thenable chain object where all methods (`.from()`, `.where()`, `.orderBy()`, `.returning()`) return `this`, and the chain resolves to `rows`
- **`makeMockDb(opts)`** — creates a mock `db` with `.select()`, `.insert()`, `.update()`, `.delete()` that return chains. Supports `selectSequence: unknown[][]` for procedures that call `select()` multiple times
- **`buildCtx(dbOverrides)`** — builds a `TRPCContext` with `userId`, `tenantId`, `role`, and a mock `db`

### Test File Setup
1. `vi.mock("@basicsos/db", ...)` — mock the DB module BEFORE importing the router
2. Import the router AFTER the mock
3. Create a `caller` via `router.createCaller(ctx)`
4. Use `EventBus.on()` / `EventBus.removeListener()` to verify events

### LLM Mock
`chatCompletion(opts, telemetry?)` has a 2-param signature. Always mock both params.

For detailed examples, see `resources/examples.md`.
