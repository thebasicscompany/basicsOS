---
name: navigate-codebase
description: Efficiently load the right context for any task. Run this first before building, fixing, or modifying anything.
---
# Skill: Navigate Codebase

## Purpose

This is the **orientation skill**. Run it before starting any non-trivial task. It tells you exactly which files to read so you have the minimum context needed — no more, no less.

## Step 1: Classify Your Task

Determine which category your task falls into, then follow the lookup table below.

| Task Type | Read These Files | Then Read |
|-----------|-----------------|-----------|
| **New module** (full feature) | `CLAUDE.md` §Adding a New Module | `context/conventions.context.md`, `context/infrastructure/database.context.md` |
| **New API endpoint** | `CLAUDE.md` §Module Anatomy | `context/infrastructure/auth.context.md` (for procedure guards) |
| **New UI page** | `context/platforms/web.context.md` | `context/ui-components.context.md` |
| **Modify existing module** | The module's context file (see §Module Lookup) | The router + schema files for that module |
| **Fix a bug** | The failing file + its test file | The module's context file |
| **Add a worker** | `CLAUDE.md` §Workers & Background Jobs | `packages/api/src/workers/queue.ts` |
| **Add MCP tool** | `CLAUDE.md` §MCP Tools | `context/platforms/mcp.context.md` |
| **Mobile feature** | `context/platforms/mobile.context.md` | `apps/mobile/app/` directory structure |
| **Desktop/overlay feature** | `context/platforms/desktop.context.md` | `apps/desktop/src/main/index.ts` |
| **Auth changes** | `context/infrastructure/auth.context.md` | `packages/auth/src/config.ts` |
| **Database migration** | `context/infrastructure/database.context.md` | `packages/db/src/schema/` |
| **Deployment** | `context/infrastructure/deployment.context.md` | `railway.toml`, `docker-compose.yml` |
| **AI/LLM feature** | `CLAUDE.md` §LLM Client + §Streaming AI | `packages/api/src/lib/llm-client.ts` |
| **Billing/payments** | `CLAUDE.md` §Billing & Subscriptions | `packages/api/src/routers/billing.ts` |
| **OAuth integration** | `CLAUDE.md` §Hub OAuth Integrations | `packages/api/src/routers/hub.ts`, `packages/api/src/lib/oauth-encrypt.ts` |
| **Admin panel** | `CLAUDE.md` §Admin Panel | `packages/api/src/routers/admin.ts` |
| **UI component** | `context/ui-components.context.md` | `packages/ui/src/index.ts` (see what's exported) |

## Step 2: Module Lookup

When working on a specific module, read its context file first:

| Module | Context File | Router | Schema |
|--------|-------------|--------|--------|
| Knowledge base | `context/modules/knowledge-base.context.md` | `packages/api/src/routers/knowledge.ts` | `packages/db/src/schema/documents.ts` *(named documents, not knowledge)* |
| CRM | `context/modules/crm.context.md` | `packages/api/src/routers/crm.ts` | `packages/db/src/schema/crm.ts` |
| Tasks | `context/modules/task-manager.context.md` | `packages/api/src/routers/tasks.ts` | `packages/db/src/schema/tasks.ts` |
| Meetings | `context/modules/meeting-notes.context.md` | `packages/api/src/routers/meetings.ts` | `packages/db/src/schema/meetings.ts` |
| Hub | `context/modules/hub.context.md` | `packages/api/src/routers/hub.ts` | `packages/db/src/schema/hub.ts` |
| AI Employees | `context/modules/ai-employees.context.md` | `packages/api/src/routers/ai-employees.ts` | `packages/db/src/schema/ai-employees.ts` |
| Assistant | `CLAUDE.md` §Streaming AI | `packages/api/src/routers/assistant.ts` | — |
| Automations | `context/modules/ai-employees.context.md` *(shared with AI Employees)* | `packages/api/src/routers/automations.ts` | `packages/db/src/schema/automations.ts` |
| Auth | `context/infrastructure/auth.context.md` | `packages/api/src/routers/auth.ts` | `packages/db/src/schema/tenants.ts` |
| Admin | `CLAUDE.md` §Admin Panel | `packages/api/src/routers/admin.ts` | `packages/db/src/schema/system.ts` |
| Billing | `CLAUDE.md` §Billing & Subscriptions | `packages/api/src/routers/billing.ts` | `packages/db/src/schema/system.ts` |
| LLM Keys | `CLAUDE.md` §LiteLLM Proxy | `packages/api/src/routers/llm-keys.ts` | `packages/db/src/schema/system.ts` |
| Modules config | `CLAUDE.md` §Module Config | `packages/api/src/routers/modules.ts` | `packages/db/src/schema/system.ts` |
| Search | `context/architecture.context.md` | `packages/api/src/routers/search.ts` | — |

## Step 3: Fast Discovery Commands

When you need to find something specific, use these patterns instead of reading entire directories:

### Find where something is defined
```bash
# Find a table definition
Grep: pattern="= pgTable\("  glob="packages/db/src/schema/*.ts"

# Find a router procedure
Grep: pattern="protectedProcedure|memberProcedure|adminProcedure"  path="packages/api/src/routers/MODULE.ts"

# Find all event types
Grep: pattern="type:.*\""  path="packages/shared/src/types/events.ts"

# Find a UI component
Grep: pattern="export.*function|export.*const"  path="packages/ui/src/components/COMPONENT.tsx"

# Find where a component is used
Grep: pattern="<ComponentName"  glob="apps/web/src/**/*.tsx"

# Find all tRPC hooks for a module
Grep: pattern="trpc\.MODULE\."  glob="apps/web/src/**/*.tsx"
```

### Find the right file to edit
```bash
# Web page for a route
Glob: pattern="apps/web/src/app/(dashboard)/ROUTE/**/page.tsx"

# Mobile screen for a tab
Glob: pattern="apps/mobile/app/(tabs)/TAB/**"

# Worker for a queue
Grep: pattern="QUEUE_NAME"  path="packages/api/src/workers/"

# MCP tool registration
Grep: pattern="server.tool"  path="apps/mcp/company/src/"

# API webhook handler
Glob: pattern="apps/web/src/app/api/webhooks/**"

# Context file for a topic
Glob: pattern="context/**/*KEYWORD*.context.md"
```

### Understand a module quickly
```bash
# 1. Read the context file
Read: context/modules/MODULE.context.md

# 2. See the router's public API (procedure names)
Grep: pattern="(protectedProcedure|memberProcedure|adminProcedure)" path="packages/api/src/routers/MODULE.ts" output_mode="content"

# 3. See the schema (table columns)
Read: packages/db/src/schema/MODULE.ts

# 4. See tests (expected behavior)
Read: packages/api/src/routers/MODULE.test.ts

# 5. See the web UI
Glob: pattern="apps/web/src/app/(dashboard)/MODULE/**/*.tsx"
```

## Step 4: Architecture Quick Reference

### Data flow for any feature
```
User action → Web/Mobile/Desktop UI
    ↓
tRPC mutation (packages/api/src/routers/MODULE.ts)
    ↓
DB write (packages/db — Drizzle ORM, RLS auto-filters by tenant)
    ↓
EventBus.emit() → BullMQ queue → Worker → side effects
```

### Auth hierarchy (which procedure to use)
```
protectedProcedure  → userId guaranteed, tenantId may be null
    ↓                  Use for: auth.me, modules.list (fresh users)
memberProcedure     → userId + tenantId guaranteed
    ↓                  Use for: all CRUD operations
adminProcedure      → userId + tenantId + admin role guaranteed
                       Use for: billing, team mgmt, module config
```

### Platform auth methods
```
Web     → session cookie (credentials: "include" on httpBatchLink)
Mobile  → Bearer token in Authorization header (expo-secure-store)
Desktop → main window: cookie | overlay: IPC cookie extraction → Bearer
MCP     → system caller (no user auth, uses MCP_TENANT_ID)
```

### Where to register new things

| Thing | Register in |
|-------|------------|
| Router | `packages/api/src/routers/index.ts` (add to `appRouter`) |
| Schema table | `packages/db/src/schema/index.ts` (re-export) |
| Worker listener | `packages/api/src/dev.ts` (call `registerXxxListener()`) |
| Sidebar link | `packages/ui/src/components/Sidebar.tsx` |
| MCP tool | `apps/mcp/company/src/server.ts` |
| Built-in module | `BUILT_IN_MODULES` in `packages/api/src/routers/modules.ts` |
| Env var | `.env.example` + `context/infrastructure/deployment.context.md` |

## Step 5: Conventions Checklist

Before writing any code, confirm you're following these:

- [ ] Named exports only (no `export default` — except Next.js pages/layouts)
- [ ] TypeScript strict — no `any`, use `unknown` + type guards
- [ ] `const` by default — `let` only when reassignment is needed
- [ ] Functions under 40 lines — extract helpers if longer
- [ ] Co-located tests — `feature.ts` → `feature.test.ts`
- [ ] Semantic color tokens — `bg-primary` not `bg-indigo-600`
- [ ] Events after mutations — `EventBus.emit(createEvent({...}))`
- [ ] No manual tenant filtering — RLS handles it
- [ ] Secrets via `process.env["VAR"]` — fail-fast guard if required

## Full Context File Index

| Category | File | Lines | What it covers |
|----------|------|-------|---------------|
| **Architecture** | `context/architecture.context.md` | 44 | System design, monorepo structure, data flow |
| **Architecture** | `context/conventions.context.md` | 33 | Code style, naming, file organization, event pattern |
| **Architecture** | `context/ui-components.context.md` | 61 | Component library, toast API, dialog patterns |
| **Infrastructure** | `context/infrastructure/auth.context.md` | 94 | Better Auth, RBAC, invite flow, context shape |
| **Infrastructure** | `context/infrastructure/database.context.md` | 136 | Drizzle, RLS, migrations, vectors, query patterns |
| **Infrastructure** | `context/infrastructure/deployment.context.md` | 96 | Railway, Docker, CI/CD, env vars, security |
| **Platforms** | `context/platforms/web.context.md` | 171 | Next.js 15, route protection, tRPC hooks, admin panel |
| **Platforms** | `context/platforms/desktop.context.md` | 139 | Electron, electron-vite, overlay, IPC, auto-updates |
| **Platforms** | `context/platforms/mobile.context.md` | 152 | Expo SDK 54, auth flow, push notifications, EAS |
| **Platforms** | `context/platforms/mcp.context.md` | 34 | MCP servers, tool registration, transports |
| **Platforms** | `context/platforms/mcp.context.md` | 34 | MCP servers, tool registration, transports |
| **Modules** | `context/modules/knowledge-base.context.md` | 40 | Documents, embeddings, RAG, real-time sync |
| **Modules** | `context/modules/crm.context.md` | 30 | Contacts, companies, deals, pipeline |
| **Modules** | `context/modules/task-manager.context.md` | 22 | Tasks, status/priority enums, cross-module links |
| **Modules** | `context/modules/meeting-notes.context.md` | 47 | Meetings, transcripts, AI summaries, async processing |
| **Modules** | `context/modules/hub.context.md` | 32 | Hub links, OAuth integrations |
| **Modules** | `context/modules/ai-employees.context.md` | 41 | AI jobs, outputs, approval workflow |
