# Basics OS — Developer Guide

Basics OS is an open-source company operating system — knowledge base, CRM, task manager, meeting intelligence, AI assistant, automations — all connected to one database, accessible from web, desktop, mobile, and MCP.

> **First step for any task:** Run [`/navigate-codebase`](/.claude/skills/navigate-codebase/SKILL.md) to load the right context files.

## Repo Structure

```
apps/web/          Next.js 15 portal          apps/mcp/company/   Company MCP server
apps/desktop/      Electron v33 overlay+dash  apps/mcp/engineer/  Engineer MCP server
apps/mobile/       Expo SDK 54                packages/api/       tRPC v11 + Hono v4
packages/db/       Drizzle ORM, 34 tables     packages/auth/      Better Auth v1 (RBAC)
packages/shared/   Zod validators, types      packages/ui/        Tailwind v4 + Radix components
packages/sync/     Yjs CRDTs                  packages/config/    Shared TS/ESLint/Prettier
context/           Deep-dive docs per area    .claude/skills/     10 Claude Code skills
```

## Architecture

All platforms connect to **one tRPC API** → one PostgreSQL+pgvector DB (RLS) → one EventBus → BullMQ workers.

The Company MCP server imports `appRouter` directly — no HTTP hop.

For deep dives: [context/architecture.context.md](context/architecture.context.md)

## Code Rules

- **Named exports only** — no `export default` (except Next.js pages/layouts, Vitest/Plop config)
- **TypeScript strict** — no `any`, no unsafe casts. Use `unknown` + type guards
- **`const` by default** — `let` only when reassignment is needed
- **Early returns** — reduce nesting
- **Functions under 40 lines** — extract helpers if longer
- **Co-locate tests** — `feature.ts` → `feature.test.ts` in same directory

## Module Pattern

Every module has 5 layers: Schema → Validators → Router → UI → Context. Use `bun gen:module` to scaffold.

```ts
export const tasksRouter = router({
  list: protectedProcedure.input(z.object({...})).query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return ctx.db.select().from(tasks); // RLS handles tenant isolation
  }),
  create: memberProcedure.input(insertTaskSchema.omit({ tenantId: true, createdBy: true }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db.insert(tasks).values({ ...input, tenantId: ctx.tenantId, createdBy: ctx.userId }).returning();
      EventBus.emit(createEvent({ type: "task.created", tenantId: ctx.tenantId, payload: { taskId: task.id } }));
      return task;
    }),
});
```

**Procedure access levels:**
- `protectedProcedure` = requires login. Check `ctx.tenantId` manually.
- `memberProcedure` = requires login + tenantId (non-null guaranteed).
- `adminProcedure` = requires admin role + tenantId.

**Database:** Never filter by `tenantId` in WHERE — RLS does it automatically. Every mutation emits an event via `EventBus.emit(createEvent({...}))`.

## Design System

### Tokens & Colors

- **Web/Desktop**: `packages/ui/src/tokens.css` — single source of truth
- **Mobile**: `apps/mobile/lib/tokens.ts` — mirrored constants
- Palette: **warm stone** (never `gray-*`). Brand: `#6366f1` (indigo, use `bg-primary` not `bg-indigo-600`)

| stone-900 | primary text | stone-200 | default borders |
|-----------|-------------|-----------|-----------------|
| stone-700 | section headings | stone-300 | strong borders |
| stone-500 | secondary text | stone-100 | subtle backgrounds |
| stone-400 | placeholders | stone-50 | app background |

### Typography

**Plus Jakarta Sans** (body via `--font-sans`) + **Lora** (serif accents — **only** on `PageHeader` H1, dashboard greeting H1, `EmptyState` heading). Never apply `font-serif` to body text, card titles, or labels.

### Radius

| `rounded-md` | buttons, inputs, badges | `rounded-lg` | cards, dialogs, toasts |
|---------------|------------------------|---------------|------------------------|
| `rounded-xl` | AppShell panels | `rounded-full` | pills only |

### Icons

All from `lucide-react` / `lucide-react-native`. Import re-exports from `@basicsos/ui`. Never use emoji as icons.

## Component-First Rules (MANDATORY)

**Every UI element must come from `@basicsos/ui`.** Only raw `<div>`, `<form>`, `<section>` for layout wrappers.

```ts
import { Button, Input, Card, Dialog, Badge, EmptyState, addToast, cn } from "@basicsos/ui";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@basicsos/ui";
import { AppShell, SidebarPanel, PageHeader, CodeBlock, SectionLabel, IconBadge, InlineCode } from "@basicsos/ui";
import { Avatar, AvatarFallback, Tabs, TabsList, TabsTrigger, TabsContent, Select, Switch } from "@basicsos/ui";
```

| Instead of... | Use |
|--------------|-----|
| `<div className="border bg-white rounded-...">` | `<Card>` |
| `<button>`, inline styled buttons | `<Button>` (CVA: default/destructive/outline/ghost/link) |
| Raw `<table>` | `<Table>` + sub-components |
| Raw pill-button tabs | `<Tabs>` + sub-components |
| Raw avatar div circles | `<Avatar>` + `<AvatarFallback>` |
| `<pre>` + copy button | `<CodeBlock label="..." code="...">` |
| `text-xs uppercase tracking-wider` | `<SectionLabel>` |
| `h-10 w-10 rounded-xl bg-*-50` icon circles | `<IconBadge>` |
| Inline `<code className="...">` | `<InlineCode>` |
| Custom modal divs | `<Dialog>` + sub-components |
| Inline empty messages | `<EmptyState>` |

**Rules:**
1. Check `@basicsos/ui` before writing any raw HTML element
2. Never duplicate markup across pages — extract to `packages/ui/src/components/`
3. Promote local components to `@basicsos/ui` at 3+ uses
4. After adding a new component: export from `packages/ui/src/index.ts`, run `bun --filter @basicsos/ui build`

### Form + Mutation + Toast Pattern

```tsx
const mutate = trpc.myModule.create.useMutation({
  onSuccess: () => { addToast({ title: "Created!", variant: "success" }); setOpen(false); },
  onError: (err) => { addToast({ title: "Error", description: err.message, variant: "destructive" }); },
});
```

### "use client" Rules

- Add to components using hooks (`useState`, `useEffect`, `useRouter`, tRPC hooks)
- Radix components have it built-in — consuming code may still need it
- Server components (`Card`, `Badge`, `Input`) do NOT need it

### Mobile Tokens

**Never hardcode hex values or borderRadius numbers in mobile code.** Always use `colors.*` and `radius.*` from `apps/mobile/lib/tokens.ts`. Add new tokens there first if needed.

## Common Tasks

| Task | Skill |
|------|-------|
| Orient / find context | `/navigate-codebase` |
| Add a field | `@.claude/skills/add-field` |
| Add a tRPC endpoint | `@.claude/skills/new-api-endpoint` |
| Create a UI view | `@.claude/skills/new-view` |
| Expose an MCP tool | `@.claude/skills/new-mcp-tool` |
| Build a full module | `@.claude/skills/new-module` |
| Add an automation | `@.claude/skills/new-automation-trigger` |
| Write tests | `@.claude/skills/testing-patterns` |
| UI components | `@.claude/skills/ui-components` |
| Standardize UI | `@.claude/skills/standardize-ui` |

## Running Locally

```bash
bun dev:setup                              # first-time setup (Docker, .env, seed)
bun --filter @basicsos/api dev             # API on :3001
bun --filter @basicsos/web dev             # Web on :3000
bun --filter @basicsos/desktop dev         # Desktop (needs web on :3000)
bun test                                   # all tests
```

Required env: `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Optional: see `.env.example`.

## Reference (Context Files)

For detailed docs on specific areas, read the relevant context file:

| Area | File |
|------|------|
| Architecture & data flow | `context/architecture.context.md` |
| Code conventions | `context/conventions.context.md` |
| UI component library | `context/ui-components.context.md` |
| Auth (Better Auth, RBAC) | `context/infrastructure/auth.context.md` |
| Database (Drizzle, RLS, pgvector) | `context/infrastructure/database.context.md` |
| Deployment (Railway, Docker) | `context/infrastructure/deployment.context.md` |
| Web (Next.js 15) | `context/platforms/web.context.md` |
| Desktop (Electron, overlay, IPC) | `context/platforms/desktop.context.md` |
| Mobile (Expo SDK 54) | `context/platforms/mobile.context.md` |
| MCP server | `context/platforms/mcp.context.md` |
| Knowledge base | `context/modules/knowledge-base.context.md` |
| CRM | `context/modules/crm.context.md` |
| Tasks | `context/modules/task-manager.context.md` |
| Meetings | `context/modules/meeting-notes.context.md` |
| Hub & OAuth | `context/modules/hub.context.md` |
| AI employees & automations | `context/modules/ai-employees.context.md` |

## What Not to Do

- No `export default` (except Next.js pages/layouts)
- No `any` — use `unknown` + type guards
- No manual `tenantId` filtering — RLS handles it
- No hardcoded secrets — use `process.env["VAR"]`
- No `gray-*` Tailwind — always `stone-*`
- No `bg-indigo-600` — use `bg-primary`
- No `font-serif` except PageHeader H1, dashboard greeting, EmptyState heading
- No raw HTML when `@basicsos/ui` component exists (`<button>`, `<table>`, `<input>`, styled `<div>`)
- No duplicated UI patterns — extract to `packages/ui/`
- No hardcoded hex/borderRadius in mobile — use tokens
- No emoji as icons — use Lucide
- Desktop overlay must use `@basicsos/ui` components
