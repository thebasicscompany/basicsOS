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
- Reset mocks between tests

For detailed examples, see `resources/examples.md`.
