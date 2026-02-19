# Basics OS — Developer Guide

Basics OS is an open-source company operating system. Companies clone this repo and get a complete internal tool suite: knowledge base, CRM, task manager, meeting intelligence, AI assistant, automations, and more — all connected to a single database and accessible from web, desktop, mobile, and AI tools via MCP.

## What's In Here

```
apps/
  web/          Next.js 15 web portal (the main UI)
  desktop/      Electron v33 desktop app (overlay + dashboard)
  mobile/       Expo SDK 54 mobile app
  mcp/company/  Company MCP server (AI tools connect here)
  mcp/engineer/ Engineer MCP server (Claude Code connects here)

packages/
  api/          tRPC v11 + Hono v4 — single API server for everything
  db/           Drizzle ORM schema — 24 tables, RLS, pgvector
  auth/         Better Auth v1 — RBAC (admin/member/viewer)
  shared/       Zod validators, TypeScript types, event schemas
  ui/           Shared React components (Tailwind v4 + Radix)
  sync/         Yjs CRDTs for real-time document collaboration
  config/       Shared TS, ESLint, Prettier configs
```

## Architecture in 30 Seconds

Every platform (web, desktop, mobile, MCP) connects to **one tRPC API server**. One database. One auth system. One event bus.

```
User → Web/Desktop/Mobile/MCP
         ↓
    tRPC appRouter (packages/api)
         ↓
    PostgreSQL + pgvector (packages/db)
         ↓
    EventBus → BullMQ workers → side effects
```

The Company MCP server imports `appRouter` directly — no HTTP hop. When an AI tool calls `search_knowledge_base`, it runs the same tRPC procedure as the web app.

## Adding a New Module

The fastest path is the code generator:

```bash
pnpm gen:module
```

Prompts you for name, description, fields → scaffolds all 5 layers:
1. **Schema** — `packages/db/src/schema/[name].ts` (Drizzle table with `tenant_id` + RLS)
2. **Validators** — `packages/shared/src/validators/[name].ts` (Zod schemas)
3. **Router** — `packages/api/src/routers/[name].ts` (tRPC CRUD + events)
4. **UI** — packages/ui components (list, detail, form)
5. **Context** — `context/modules/[name].context.md` (for AI tools)

Then add it to `packages/api/src/routers/index.ts`:
```ts
import { myRouter } from "./my-module.js";
export const appRouter = router({ ..., myModule: myRouter });
```

See: [@.claude/skills/add-field](/.claude/skills/add-field/SKILL.md) · [@.claude/skills/new-api-endpoint](/.claude/skills/new-api-endpoint/SKILL.md)

## Module Anatomy

Every module follows this exact pattern:

```ts
// packages/api/src/routers/tasks.ts
export const tasksRouter = router({
  list: protectedProcedure          // read: any authenticated user
    .input(z.object({ ... }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return ctx.db.select().from(tasks).where(eq(tasks.tenantId, ctx.tenantId));
    }),

  create: memberProcedure           // write: member or admin
    .input(insertTaskSchema.omit({ tenantId: true, createdBy: true }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db.insert(tasks)
        .values({ ...input, tenantId: ctx.tenantId, createdBy: ctx.userId })
        .returning();
      EventBus.emit(createEvent({ type: "task.created", tenantId: ctx.tenantId, payload: { taskId: task.id } }));
      return task;
    }),
});
```

**Rules:**
- `protectedProcedure` = requires login. Check `ctx.tenantId` manually.
- `memberProcedure` = requires login + tenantId (non-null guaranteed).
- `adminProcedure` = requires admin role + tenantId.
- Never filter by `tenantId` in WHERE — RLS does it automatically at DB level.
- Always emit an event after mutations.

## Database Patterns

All tables have `tenant_id`. RLS policies enforce isolation automatically — you never write `WHERE tenant_id = ?`.

```ts
// DO: RLS handles tenant isolation
const docs = await ctx.db.select().from(documents);

// DON'T: redundant but harmless if you add it manually
const docs = await ctx.db.select().from(documents).where(eq(documents.tenantId, ctx.tenantId));
```

To add a field to an existing table:
1. Add column to `packages/db/src/schema/[table].ts`
2. Run `pnpm db:generate` then `pnpm db:migrate`
3. Add field to Zod validator in `packages/shared/src/validators/[module].ts`
4. Update tRPC router input schemas

See: [context/infrastructure/database.context.md](context/infrastructure/database.context.md)

## Event System

Every mutation emits an event. Subscribers and workers react asynchronously.

```ts
EventBus.emit(createEvent({
  type: "crm.deal.stage_changed",
  tenantId: ctx.tenantId,
  userId: ctx.userId,
  payload: { dealId: deal.id, fromStage: "lead", toStage: "qualified" },
}));
```

All event types are defined in `packages/shared/src/types/events.ts`. Workers in `packages/api/src/workers/` process them via BullMQ queues.

## MCP Tools

To expose a tRPC procedure as an MCP tool (so Claude/ChatGPT can call it):

```ts
// apps/mcp/company/src/tools/my-tool.ts
export const registerMyTool = (server: McpServer): void => {
  server.tool("my_tool_name", "Description", { param: z.string() }, async ({ param }) => {
    const tenantId = process.env["MCP_TENANT_ID"] ?? "";
    const caller = createSystemCaller(tenantId);
    const result = await caller.myModule.list({ search: param });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });
};
```

Register it in `apps/mcp/company/src/server.ts`. See: [@.claude/skills/new-mcp-tool](/.claude/skills/new-mcp-tool/SKILL.md)

## Code Rules

- **Named exports only** — no `export default` (except Next.js pages/layouts, Vitest config, Plop config — framework requirements)
- **TypeScript strict** — no `any`, no unsafe casts. Use `unknown` + type guards.
- **`const` by default** — `let` only when reassignment is needed
- **Early returns** — reduce nesting
- **Functions under 40 lines** — extract helpers if longer
- **Co-locate tests** — `feature.ts` → `feature.test.ts` in same directory
- **Group by feature** — `crm/contacts.ts` not `routers/contacts.ts`

## Common Tasks

| Task | Where to look |
|------|--------------|
| Add a field to a table | [@.claude/skills/add-field](/.claude/skills/add-field/SKILL.md) |
| Add a tRPC endpoint | [@.claude/skills/new-api-endpoint](/.claude/skills/new-api-endpoint/SKILL.md) |
| Create a UI view | [@.claude/skills/new-view](/.claude/skills/new-view/SKILL.md) |
| Expose a tool to AI | [@.claude/skills/new-mcp-tool](/.claude/skills/new-mcp-tool/SKILL.md) |
| Build a full module | [@.claude/skills/new-module](/.claude/skills/new-module/SKILL.md) |
| Add an automation | [@.claude/skills/new-automation-trigger](/.claude/skills/new-automation-trigger/SKILL.md) |
| Write tests | [@.claude/skills/testing-patterns](/.claude/skills/testing-patterns/SKILL.md) |
| Architecture decision | [@.claude/skills/architecture](/.claude/skills/architecture/SKILL.md) |

## Running Locally

```bash
pnpm dev:setup          # first-time: generates .env, starts Docker, seeds demo data
pnpm --filter @basicsos/api dev    # API server on :3001
pnpm --filter @basicsos/web dev    # Web portal on :3000
pnpm test               # run all tests (166 passing)
npx vitest run          # integration + security tests
```

Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env` to enable AI features.

## Agents & Automation

Claude Code agents in `.claude/agents/` extend your workflow:

- **feature-builder** — builds a full module end-to-end from a description
- **module-creator** — scaffolds schema + router + UI + tests
- **code-reviewer** — reviews changes: PASS / CONCERNS / BLOCK
- **test-runner** — writes and runs tests for a given file
- **security-auditor** — OWASP Top 10 audit before merging
- **debugger** — root cause analysis for errors and test failures
- **bug-fixer** — targeted fix for a reported bug

## What Not to Do

- Don't add default exports (breaks tree-shaking + Claude Code conventions)
- Don't use `any` — use `unknown` with type guards
- Don't filter by `tenant_id` manually — RLS handles it
- Don't hardcode secrets — use `process.env["VAR"]` with fail-fast guard
- Don't add third-party billing or hosting provider integrations — this repo focuses on the product itself
- Don't modify `main` branch directly — always use feature branches (or worktrees for autonomous agents)
