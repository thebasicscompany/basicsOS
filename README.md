# Basics OS

**The open-source company operating system.**

Knowledge base · CRM · Tasks · Meetings · AI Assistant · Automations — all in one database, accessible from web, desktop, mobile, and AI tools via MCP.

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![tRPC](https://img.shields.io/badge/tRPC-v11-398CCB)](https://trpc.io/)

![Dashboard](dashboard.png)

---

## Table of Contents

- [Quick Start](#quick-start)
- [What's Included](#whats-included)
- [Platforms](#platforms)
  - [Web](#web----appsweb)
  - [Desktop](#desktop----appsdesktop)
  - [Mobile](#mobile----appsmobile)
  - [MCP Servers](#mcp-servers)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Commands](#commands)
- [Deployment](#deployment)
  - [Railway](#railway-recommended)
  - [Docker](#docker)
- [Developing with Claude Code](#developing-with-claude-code)
- [Customizing the UI](#customizing-the-ui)
  - [Company Assets](#company-assets)
  - [Changing Brand Colors](#changing-brand-colors)
  - [Adding or Modifying Components](#adding-or-modifying-components)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) · [Bun 1.2+](https://bun.sh)

```bash
git clone https://github.com/basicos/basicos
cd basicos
bun scripts/create-basicos.ts
```

The interactive setup wizard runs — no prior `bun install` needed. It asks which
apps you want, then only installs those. Skipping Desktop or Mobile saves
**200–500 MB** of dependencies.

```
◆  Which apps do you need?
│  ◼  Web portal    Next.js — the main UI
│  ◻  Desktop app   Electron — macOS / Windows / Linux  (~200 MB)
│  ◻  Mobile app    Expo — iOS & Android  (~500 MB)
│  ◻  MCP servers   Claude / ChatGPT tool integration
```

It generates your `.env`, starts Postgres + Redis in Docker, runs migrations,
and seeds demo data. Once it's done, start the servers:

```bash
bun --filter @basicsos/api dev   # API on :3001
bun --filter @basicsos/web dev   # Web on :3000
```

Open **http://localhost:3000** and sign in with the demo account:

```
Email:    admin@acme.example.com
Password: password
```

> **Want everything?** To install all apps without prompts:
> ```bash
> bun run dev:setup
> ```

---

## What's Included

| Module             | Description                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------- |
| **Knowledge Base** | Rich-text docs (TipTap), real-time collaboration (Yjs), full-text + vector search         |
| **CRM**            | Contacts, companies, deals — 6-stage Kanban pipeline, activity log                        |
| **Tasks**          | Kanban board, priorities, due dates, assignees                                            |
| **Meetings**       | Paste or record transcripts, AI-generated summaries (decisions, action items, follow-ups) |
| **Hub**            | Bookmark links, connect Slack / Google Drive / GitHub via OAuth                           |
| **AI Assistant**   | Streaming chat grounded in your company data via RAG                                      |
| **AI Employees**   | Autonomous jobs with human-in-the-loop approval                                           |
| **Automations**    | Event-driven workflows (trigger + action chains)                                          |

### Admin Panel

- **Team** — invite members, manage roles (admin / member / viewer)
- **Modules** — enable or disable any module per tenant
- **Usage** — LLM spend by model, user, and feature
- **Security** — immutable audit log
- **Branding** — company name, logo, accent color

---

## Platforms

### Web — `apps/web/`

Next.js 15 App Router. All modules, admin panel, onboarding, settings.

### Desktop — `apps/desktop/`

Electron v33. Two windows:

- **Main** — full web app (1280×800)
- **Overlay** — frameless, always-on-top, toggle with `⌘⇧Space` / `Ctrl⇧Space`

Overlay tabs: Ask (AI Q&A) · Meetings (live transcript) · Voice (dictation + commands) · Capture (screenshot → knowledge base)

```bash
bun --filter @basicsos/desktop dev   # requires web running on :3000
```

### Mobile — `apps/mobile/`

Expo SDK 54. Home, Tasks, CRM, Meetings, Knowledge, Assistant, AI Employees, Hub.

```bash
bun --filter @basicsos/mobile start
```

### MCP Servers

AI tools connect to Basics OS through MCP.

**Company MCP** — for Claude Desktop, Cursor, ChatGPT, and any MCP client:

| Tool                    | What it does                           |
| ----------------------- | -------------------------------------- |
| `search_knowledge_base` | Search your documents                  |
| `query_crm`             | Query contacts, companies, deals       |
| `list_tasks`            | List tasks with optional status filter |
| `search_meetings`       | Search transcripts and summaries       |

Add to `claude_desktop_config.json` (or Cursor's MCP settings):

```json
{
  "mcpServers": {
    "basicsos": {
      "command": "bun",
      "args": ["run", "/path/to/basicsOS/apps/mcp/company/src/index.ts"],
      "env": {
        "MCP_TENANT_ID": "<your-tenant-id>",
        "DATABASE_URL": "postgresql://basicos:basicos_dev@localhost:5432/basicos",
        "REDIS_URL": "redis://localhost:6379"
      }
    }
  }
}
```

Find your Tenant ID in **Settings → MCP Connection**.

**Engineer MCP** — for Claude Code during development:

```bash
REPO_ROOT=$PWD bun --filter @basicsos/mcp-engineer dev   # port 4001
```

---

## Architecture

Every platform connects to one API. One database. One auth system. One event bus.

```
Web / Desktop / Mobile / MCP
          │
    tRPC appRouter        14 routers
          │
    PostgreSQL + pgvector  34 tables, row-level security
          │
    EventBus → BullMQ workers
          ├── embedding          (vectorize docs + transcripts)
          ├── meeting-processor  (AI summaries + push notifications)
          ├── notification       (in-app + Expo Push API)
          ├── ai-employee        (autonomous Claude jobs)
          └── automation-executor
```

The Company MCP server imports `appRouter` directly — no HTTP hop. An MCP tool call runs the same tRPC procedure as the web app.

### Repository Structure

```
apps/
  web/             Next.js 15 web portal
  desktop/         Electron v33 overlay app
  mobile/          Expo SDK 54 mobile app
  mcp/company/     Company MCP server
  mcp/engineer/    Engineer MCP server (for Claude Code)

packages/
  api/             tRPC v11 + Hono v4 API server
  db/              Drizzle ORM schema (34 tables, RLS, pgvector)
  auth/            Better Auth v1 (RBAC: admin/member/viewer)
  shared/          Zod validators, TypeScript types, event schemas
  ui/              React components (Tailwind v4 + Radix + Lucide)
  sync/            Yjs CRDTs for real-time collaboration
  config/          Shared TypeScript, ESLint, Prettier configs
```

---

## Environment Variables

**Required** (auto-generated by `bun run dev:setup` or `scripts/dev-setup.sh`):

| Variable              | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string                   |
| `REDIS_URL`           | Redis connection string                        |
| `BETTER_AUTH_SECRET`  | Session signing key (32+ random chars)         |
| `BETTER_AUTH_URL`     | Auth server base URL (`http://localhost:3000`) |
| `NEXT_PUBLIC_APP_URL` | Public web app URL                             |
| `NEXT_PUBLIC_API_URL` | Public API URL (`http://localhost:3001`)        |

**Optional** (unlock specific features):

| Variable                                      | Feature                                     |
| --------------------------------------------- | ------------------------------------------- |
| `ANTHROPIC_API_KEY`                           | AI assistant, meeting summaries, embeddings |
| `DEEPGRAM_API_KEY`                            | Live meeting transcription                  |
| `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` | Billing                                     |
| `STRIPE_PRICE_STARTER` · `STRIPE_PRICE_TEAM`  | Stripe plan IDs                             |
| `SLACK_CLIENT_ID` · `SLACK_CLIENT_SECRET`     | Hub: Slack                                  |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET`   | Hub: Google Drive                           |
| `GITHUB_CLIENT_ID` · `GITHUB_CLIENT_SECRET`   | Hub: GitHub                                 |
| `OAUTH_ENCRYPTION_KEY`                        | AES-256-GCM for OAuth tokens (64 hex chars) |

---

## Commands

```bash
# Development
bun run dev:setup                  # first-time setup (Windows, macOS, Linux)
bun run dev:setup:bash             # first-time setup via bash (macOS/Linux only)
bun dev                            # start API + web together (recommended)
bun start                          # start in production mode (requires bun build first)
bun --filter @basicsos/api dev     # API server only, on :3001
bun --filter @basicsos/web dev     # web portal only, on :3000
bun --filter @basicsos/desktop dev # desktop app (requires web on :3000)

# Assets
bun run assets:sync                # copy assets/ to all apps after replacing your logo

# Database
bun db:generate                    # generate migration SQL from schema changes
bun db:migrate                     # apply migrations + RLS policies
bun db:seed                        # seed demo data
bun db:studio                      # open Drizzle Studio (visual DB browser)

# Code quality
bun test                           # run all tests
bun lint                           # lint all packages
bun typecheck                      # TypeScript type-check all packages

# Scaffolding
bun gen:module                     # interactive: scaffold a new module
```

---

## Deployment

### Railway (Recommended)

```bash
railway up
```

`railway.toml` defines two services (`web` on :3000, `api` on :3001). The template auto-provisions PostgreSQL 16 with pgvector and Redis. `BETTER_AUTH_SECRET` and `OAUTH_ENCRYPTION_KEY` are generated automatically.

### Docker

```bash
docker-compose up                             # dev: Postgres + Redis only
docker-compose -f docker-compose.prod.yml up  # prod: full stack
```

---

## Developing with Claude Code

Basics OS is built for AI-assisted development. The repo ships with Claude Code skills and agents that can navigate the codebase, scaffold full modules, write tests, and review changes.

**Start any task with:**

```
/navigate-codebase
```

This loads exactly the right context files for what you're building — no manual searching.

### Skills

| Command              | What it does                                               |
| -------------------- | ---------------------------------------------------------- |
| `/navigate-codebase` | Load context for any task                                  |
| `/new-module`        | Scaffold schema + router + UI + tests for a new module     |
| `/add-field`         | Add a column with migration, validator, and router updates |
| `/new-api-endpoint`  | Create a tRPC procedure with input validation and events   |
| `/new-view`          | Build a dashboard page with data fetching and forms        |
| `/new-mcp-tool`      | Expose a tRPC procedure as an MCP tool                     |
| `/testing-patterns`  | Test conventions for Drizzle, tRPC context, workers        |
| `/ui-components`     | Component patterns, design tokens, form + mutation recipe  |

### Agents

| Agent              | What it does                                      |
| ------------------ | ------------------------------------------------- |
| `feature-builder`  | Builds a full module from a description           |
| `code-reviewer`    | Returns PASS / CONCERNS / BLOCK on staged changes |
| `security-auditor` | OWASP Top 10 audit before merging                 |
| `debugger`         | Root cause analysis for errors and test failures  |
| `bug-fixer`        | Targeted fix for a reported bug                   |
| `test-runner`      | Writes and runs tests for a given file            |

---

## Customizing the UI

Basics OS uses a component-first architecture. Every UI element comes from a shared component library — change it once, it updates across web, desktop, and mobile.

### Company Assets

All brand assets live in one place:

```
assets/
  icon.svg    ← your company icon (browser favicon, sidebar logo, app icon)
```

To white-label the app, replace `assets/icon.svg` with your own logo, then run:

```bash
bun run assets:sync
```

This copies your assets to every platform:

| Destination | Used for |
|---|---|
| `apps/web/public/icon.svg` | Browser favicon + sidebar logo |
| `apps/mobile/assets/icon.svg` | Expo app icon |
| `apps/desktop/resources/icon.svg` | Electron app icon |

The sidebar logo and browser tab icon update immediately on the next build. For dynamic per-tenant branding (logo URL + accent color), see **Admin → Branding** in the web app.

### How It Works

```
packages/ui/src/
├── tokens.css              ← CSS variables (colors, radius, shadows)
├── components/             ← 20+ shared React components
│   ├── Button.tsx          ← change button style here → all platforms update
│   ├── Card.tsx
│   ├── Table.tsx
│   ├── AppShell.tsx        ← dashboard layout shell
│   ├── SidebarPanel.tsx    ← sidebar container
│   └── ...
└── index.ts                ← single export barrel

apps/web/globals.css        ← imports tokens, defines Tailwind theme
apps/desktop/main.css       ← imports same tokens + @source for Tailwind
apps/mobile/lib/tokens.ts   ← mirrored tokens for React Native
```

### Changing Brand Colors

**Web + Desktop** — edit CSS variables in `apps/web/src/app/globals.css`:

```css
:root {
  --primary: 239 84% 67%;        /* brand color (HSL) */
  --primary-foreground: 0 0% 100%;
}
```

Both the web app and desktop overlay read the same CSS variables. The desktop main window loads the web app directly, so it inherits automatically.

**Mobile** — edit `apps/mobile/lib/tokens.ts`:

```ts
export const colors = {
  brand: "#6366f1",       // change this to your brand hex
  brandSubtle: "#eef2ff", // lighter variant for backgrounds
  // ...
};
```

Every mobile screen references `colors.*` from this file — no hardcoded hex values anywhere.

### Adding or Modifying Components

All reusable components live in `packages/ui/src/components/`. To modify:

1. Edit the component in `packages/ui/src/components/MyComponent.tsx`
2. Run `npx tsc` in `packages/ui` to rebuild
3. Every app that imports from `@basicsos/ui` gets the update

To add a new component:

1. Create `packages/ui/src/components/NewComponent.tsx`
2. Export from `packages/ui/src/index.ts`
3. Run `npx tsc` in `packages/ui`
4. Import in any app: `import { NewComponent } from "@basicsos/ui"`

### Rules for Contributors

- **Always use `@basicsos/ui` components** — never write raw `<button>`, `<table>`, `<input>`, or styled `<div>` containers when a component exists
- **Never use `gray-*` Tailwind classes** — always `stone-*` (warm palette)
- **Never hardcode hex colors in mobile code** — always reference `colors.*` from `tokens.ts`
- **Never write inline UI patterns** that duplicate existing components (tabs, avatars, code blocks, etc.)

See `CLAUDE.md` for the full component inventory, design tokens reference, and mandatory component-first rules.

---

## Tech Stack

| Layer                         | Technology                                                      |
| ----------------------------- | --------------------------------------------------------------- |
| **Runtime / Package Manager** | Bun 1.2                                                         |
| **Web**                       | Next.js 15 (App Router), React 19, Tailwind v4                  |
| **Desktop**                   | Electron v33, electron-vite                                     |
| **Mobile**                    | Expo SDK 54, React Native 0.76                                  |
| **API**                       | tRPC v11, Hono v4                                               |
| **Database**                  | PostgreSQL 16 + pgvector, Drizzle ORM                           |
| **Auth**                      | Better Auth v1 (RBAC: admin / member / viewer)                  |
| **Real-time**                 | Yjs CRDTs + Hocuspocus                                          |
| **AI**                        | Claude Sonnet (assistant + employees), Claude Haiku (summaries) |
| **Embeddings**                | OpenAI `text-embedding-3-small`                                 |
| **Transcription**             | Deepgram                                                        |
| **Billing**                   | Stripe                                                          |
| **Queues**                    | BullMQ + Redis                                                  |
| **UI**                        | Radix primitives, CVA, Lucide icons                             |
| **Build**                     | Turbo                                                           |

---

## Contributing

Pull requests are welcome. For large changes, open an issue first to discuss the approach.

```bash
git checkout -b feat/your-feature
# make changes
bun test
# open PR against main
```

See `CLAUDE.md` for codebase conventions, module patterns, and the full developer guide.

---

## License

[AGPL-3.0](LICENSE) — free to self-host and modify. Commercial licenses available at [basicsos.com](https://basicsos.com).
