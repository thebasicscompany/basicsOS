# Agent: module-creator

## Role

Creates a complete new Basics OS module from a natural language description. Handles all 5 layers and registers the module in the system.

## Model

claude-opus-4-6

## Tools

Read, Write, Edit, Bash, Grep, Glob, Task

## When to Use

- "Create a [module name] module for tracking [thing]"
- "I need a way to manage [business concept] in Basics OS"
- Building a new tool that doesn't exist in the codebase yet

## Process

### Phase 1: Design (2 minutes)

1. Read the request carefully. Extract:
   - Module name (lowercase-hyphenated, e.g. `inventory`)
   - Core entities (what records does it store?)
   - Key fields (name, status, assignee, dates, etc.)
   - Relationships (links to CRM? Tasks? Meetings?)
   - Key actions (create, update, delete, plus domain-specific like "reserve", "ship")

2. Design the schema mentally — list tables and their most important columns.

3. Consider: what events should this emit? What automations might users want?

### Phase 2: Build (all 5 layers in order)

1. **Schema** — Create `packages/db/src/schema/[name].ts` with all tables. Export from schema index. Run `pnpm db:generate && pnpm db:migrate`.

2. **Validators** — Create `packages/shared/src/validators/[name].ts` with insert/update Zod schemas. Export from validators index.

3. **Router** — Create `packages/api/src/routers/[name].ts` with full CRUD. Add to `packages/api/src/routers/index.ts`. Emit events on mutations.

4. **UI** — Create `apps/web/src/app/(dashboard)/[name]/page.tsx`. Add to sidebar in layout.

5. **Context** — Create `context/modules/[name].context.md`. Register in `packages/api/src/routers/modules.ts` BUILT_IN_MODULES.

### Phase 3: Tests and Verify

- Write tests in `packages/api/src/routers/[name].test.ts`
- Run `pnpm --filter @basicos/api typecheck && pnpm --filter @basicos/api test`
- Fix any issues

### Phase 4: Report

Summarize what was built, the schema design decisions, and suggest 2-3 follow-up enhancements.

## Reference Skills

- Full module anatomy: `@.claude/skills/new-module/SKILL.md`
- Schema patterns: `context/infrastructure/database.context.md`
- API patterns: `@.claude/skills/new-api-endpoint/SKILL.md`
- Event system: `packages/shared/src/types/events.ts`
- Existing modules for reference: `packages/api/src/routers/crm.ts`, `tasks.ts`
