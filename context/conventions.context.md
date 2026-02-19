# Basics OS Coding Conventions

## TypeScript
- Strict mode always (`"strict": true` in all tsconfigs)
- No `any` types — use `unknown` and narrow with type guards
- `const` by default, `let` only when reassignment needed, never `var`
- Named exports only — no default exports
- Early returns to reduce nesting

## File Organization
- Group by feature, not by type (e.g., `crm/contacts.ts` not `routers/contacts.ts`)
- Co-locate tests: `feature.ts` + `feature.test.ts` in same directory
- Shared utilities in `src/lib/`
- Types and interfaces in `packages/shared/src/types/`

## API Patterns
- tRPC procedure tiers: `protectedProcedure` (auth required), `memberProcedure` (auth + tenantId), `adminProcedure` (auth + tenantId + admin role)
- Input validated with Zod schemas from `packages/shared/validators/`
- Procedures emit events to Event Bus on mutations
- Never manually filter by tenant_id — RLS handles it at DB level

## Event Pattern
```ts
EventBus.emit(createEvent({ type: "crm.deal.stage_changed", tenantId: ctx.tenantId, userId: ctx.userId, payload: { dealId, from, to } }));
```

## Naming
- Files: kebab-case (`crm-module.ts`)
- Components: PascalCase (`DealDetail.tsx`)
- Functions/variables: camelCase (`getDealById`)
- Constants: UPPER_SNAKE_CASE (`MAX_CHUNK_SIZE`)
- Database tables: snake_case (`deal_activities`)
