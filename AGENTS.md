# AGENTS.md

## Project Overview

BasicsOS is a CRM hub built with React, Vite, and a Node/Hono REST API. It provides contact/deal/company management, task tracking, notes, AI chat, automations, voice (placeholder), and MCP viewer. Data is backed by PostgreSQL via Drizzle; auth uses Better Auth.

## Development Commands

### Setup
```bash
pnpm install
docker compose up -d   # Postgres on port 5435
cd packages/server && cp .env.example .env && pnpm db:migrate
```

### Running the App
```bash
pnpm run dev:rest     # Frontend + API server (recommended)
pnpm run dev          # Frontend only
pnpm run dev:server   # API server only
pnpm run dev:demo     # Demo build (uses main app)
```

### Testing and Code Quality

```bash
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run lint:apply
pnpm run prettier:apply
```

### Building

```bash
pnpm run build
```

### Database Management (Drizzle)
```bash
cd packages/server
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:seed         # admin@example.com / admin123
pnpm db:studio
```

### Registry (Shadcn Components)

```bash
pnpm run registry:build
```

## Architecture

### Technology Stack

- **Frontend**: React 19, TypeScript, Vite, React Router v7, TanStack Query
- **UI**: Shadcn UI, Radix UI, Tailwind CSS v4
- **Backend**: Node + Hono, Drizzle ORM, PostgreSQL, Better Auth
- **Packages**: `@basics-os/hub`, `@basics-os/automations`, `@basics-os/voice`, `@basics-os/mcp-viewer`, `@basics-os/server`, `@basics-os/shared`

### Directory Structure

```
src/
├── components/
│   ├── pages/           # App page components (HomePage, ChatPage, SettingsPage, TasksPage, …)
│   │                    #   + CRM generic pages (ObjectListPage, RecordDetailPage)
│   ├── object-list/     # CRM list view tabs, header actions, sort/filter pills
│   ├── record-detail/   # CRM record detail view, notes tab, delete dialog
│   ├── data-table/      # DataTable, useDataTable, pagination, column resize
│   ├── deals/           # DealsKanbanBoard
│   ├── connections/     # OAuth connections (Gmail, Slack)
│   ├── auth/            # Start page, login, signup
│   ├── ai-elements/     # Chat UI, workflow canvas, prompts
│   ├── field-types/     # Field-type registry (text, email, select, etc.)
│   └── ui/              # Shadcn UI components
├── hooks/               # useRecords, useViews, useViewState, useGatewayChat, …
├── layouts/             # AppLayout
├── providers/           # GatewayProvider, ObjectRegistryProvider
├── lib/                 # Utils, auth, gateway tools
├── overlay/             # Voice pill/overlay (Electron only)
├── main/                # Electron main process
└── App.tsx

packages/
├── server/              # Hono API, Drizzle schema, automations executor (utility)
├── automations/         # Workflow builder, nodes, VariablePicker (app)
├── hub/                 # HubLayout, HubSidebar, routes (utility)
├── voice/               # VoiceApp settings UI (app)
├── mcp-viewer/          # MCPViewerApp (app)
└── shared/              # Shared schemas, auth helpers (utility)
```

### Key Architecture Patterns

#### Objects vs Apps

The codebase has two fundamentally different building blocks:

- **Objects** = CRM entities (contacts, companies, deals, tasks, custom objects). Database-driven via `object_config` table, discovered by `ObjectRegistryProvider`, rendered by generic `ObjectListPage`/`RecordDetailPage`, routed under `/objects/:slug`. New objects require zero frontend code — just a DB row and migration.
- **Apps** = Independent feature areas with their own routes, UI, and logic. Examples: Home (`/home`), Chat (`/chat`), Automations (`/automations`), Voice (`/voice`), Settings (`/settings`), Import (`/import`), Tasks (`/tasks`), Notes (`/notes`), MCP Viewer (`/mcp`). The CRM itself is the largest app — it contains objects within it.

When building a new feature, ask: "Is this a new type of record the user creates/lists/edits?" → **Object**. "Is this a standalone tool or page with its own UI?" → **App**.

#### Object Registry (CRM Objects Only)

Objects (contacts, companies, deals, tasks, etc.) are configured via `object_config` and `custom_field_defs` tables. `ObjectRegistryProvider` and `useObject` / `useAttributes` expose configuration. List and detail views are generic: `ObjectListPage`, `RecordDetailPage` for `/objects/:objectSlug` and `/objects/:objectSlug/:recordId`.

#### Views (NocoDB-style)

Views, columns, sorts, and filters are persisted via `/api/views/*` and used by the data table. `useViews` and `useViewState` manage view selection and dirty state.

#### CRM REST API

`packages/server` exposes `/api/*` routes for CRM resources, schema, object-config, connections, automation-runs, gateway-chat, etc. Auth is session-based via Better Auth.

#### Automations

`@basics-os/automations` provides a workflow builder with trigger (event, schedule) and action (email, AI, CRM, Slack, Gmail, …) nodes. Variables like `{{trigger_data}}`, `{{ai_result}}` are resolved at execution. Topological sort is used for execution order and variable availability.

#### Path Aliases

- `@/` → `src/`
- `basics-os/src` → `src/` (for packages importing from main app)

#### Gateway Configuration (Self-Hosting)

- `BASICSOS_API_URL` defaults to `https://api.basicsos.com`. All gateway traffic (chat, embeddings, voice) goes through the server.
- Forkers can override it to point at their own gateway. No UI changes; users still add their API key in Settings.
- Key format validation is in `GatewayProvider.tsx` (line 11) and `SettingsPage.tsx` (line 58). Different gateways may need different prefixes.

#### Electron Packaging (CRITICAL)

`electron.vite.config.ts` → `main.build.externalizeDeps` **must be `false`**. electron-builder does NOT copy `node_modules` for the main process into `app.asar`. If any dependency is externalized, the packaged macOS DMG (and Windows installer) will crash on launch with `ERR_MODULE_NOT_FOUND`. Only native addons that cannot be bundled by Rollup (like `screencapturekit-audio-capture`) go in `rollupOptions.external`.

**Do NOT:**
- Set `externalizeDeps: true` or use `externalizeDeps: { exclude: [...] }` — the exclude-list approach leads to whack-a-mole with transitive deps (`ms`, `debug`, `@electron-toolkit/utils`, etc.).
- Move dependencies to `devDependencies` thinking electron-builder will skip them — it doesn't matter because we bundle everything via Vite anyway.

**Variant builds:** `electron-builder.client.yml` and `electron-builder.team.yml` produce separate DMGs with distinct `appId`/`productName` so they install side-by-side. Build with `pnpm build:mac:client`, `pnpm build:mac:team`, or `pnpm build:mac:both`.

### Adding Custom Fields

1. Add migration for `custom_field_defs` or schema changes in `packages/server`
2. Ensure the field type exists in `src/field-types`
3. Update object config if needed

### Git Hooks

- Pre-commit (husky): lint-staged

### Local Services

- Frontend: http://localhost:5173/
- API: VITE_API_URL (e.g. http://localhost:3001)

## Important Notes

- Modify `src/components/ui` directly for UI customization
- Unit tests: `*.test.ts` or `*.test.tsx` in `src/`
- `/connections` redirects to `/settings#connections`; OAuth `?connected=` is preserved and handled in Settings
