# Basics OS — Developer Guide

Basics OS is an open-source company operating system. Companies clone this repo and get a complete internal tool suite: knowledge base, CRM, task manager, meeting intelligence, AI assistant, automations, and more — all connected to a single database and accessible from web, desktop, mobile, and AI tools via MCP.

> **First step for any task:** Run the [`/navigate-codebase`](/.claude/skills/navigate-codebase/SKILL.md) skill to load exactly the context you need. It routes you to the right files based on what you're building.

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
  db/           Drizzle ORM schema — 34 tables, RLS, pgvector
  auth/         Better Auth v1 — RBAC (admin/member/viewer)
  shared/       Zod validators, TypeScript types, event schemas
  ui/           Shared React components (Tailwind v4 + Radix)
  sync/         Yjs CRDTs for real-time document collaboration
  config/       Shared TS, ESLint, Prettier configs

context/        AI context files — architecture, modules, platforms, infra
.claude/
  skills/       9 Claude Code skills (add-field, new-module, etc.)
  agents/       7 Claude Code agents (feature-builder, security-auditor, etc.)
```

## Architecture in 30 Seconds

Every platform (web, desktop, mobile, MCP) connects to **one tRPC API server**. One database. One auth system. One event bus.

```
User → Web/Desktop/Mobile/MCP
         ↓
    tRPC appRouter (packages/api) — 14 routers
         ↓
    PostgreSQL + pgvector (packages/db) — 34 tables, RLS
         ↓
    EventBus → BullMQ workers → side effects
                 ├── embedding (vectorize docs + transcripts)
                 ├── meeting-processor (AI summaries)
                 ├── notification (push + in-app)
                 ├── ai-employee (autonomous tasks)
                 ├── automation-executor (trigger → action chains)
                 └── import (bulk data ingestion)
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
      return ctx.db.select().from(tasks); // RLS filters by tenant_id automatically
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

## Workers & Background Jobs

All workers live in `packages/api/src/workers/`. They use BullMQ queues with Redis, 3 retries, exponential backoff, concurrency 5.

| Worker | Queue | What it does |
|--------|-------|-------------|
| `embedding.worker.ts` | `embedding` | Chunks docs/transcripts → `embedTexts()` → pgvector embeddings |
| `meeting-processor.worker.ts` | `meeting-processor` | Transcript → `chatCompletion` (Haiku) → structured summary + push notification |
| `notification.worker.ts` | `notification` | Persists in-app notification → sends push via Expo Push API |
| `ai-employee.worker.ts` | *(EventBus direct)* | Runs `chatCompletion` (Sonnet) → saves output with `requiresApproval: true` |
| `automation-executor.worker.ts` | `automation-executor` | Fetches automation → runs action chain → logs to `automationRuns` |
| `import.worker.ts` | `import` | Bulk data ingestion (stub) |
| `queue.ts` | — | Shared setup: `getQueue()`, `createWorker()`, `QUEUE_NAMES` |

To add a new worker:
1. Create `packages/api/src/workers/my-worker.worker.ts`
2. Export `startMyWorker` and `registerMyWorkerListener` functions
3. Register the listener in `packages/api/src/dev.ts` on startup
4. Add queue name to `QUEUE_NAMES` in `queue.ts`

## LLM Client

All AI calls go through `packages/api/src/lib/llm-client.ts`. Three functions:

```ts
// Synchronous completion — returns full response
chatCompletion(opts: ChatCompletionOptions, telemetry?: LlmTelemetryContext): Promise<ChatCompletionResponse>

// Streaming completion — yields text deltas
chatCompletionStream(opts: ChatCompletionOptions, telemetry?: LlmTelemetryContext): AsyncGenerator<string>

// Vision — analyzes a base64 PNG
analyzeImage(base64Png: string, prompt: string, telemetry?: LlmTelemetryContext): Promise<string>
```

- Default model: `claude-sonnet-4-6`. API key: `AI_API_KEY` or `ANTHROPIC_API_KEY` env var.
- Messages pass through `redactMessagesForLLM()` (PII redaction) before sending.
- **Telemetry**: pass `{ tenantId, userId, featureName }` as the second arg. Usage is logged fire-and-forget to the `llmUsageLogs` table (model, prompt/completion tokens, feature).

### Streaming AI (SSE)

The assistant page uses server-sent events instead of tRPC:

- **Endpoint**: `POST /stream/assistant` in `packages/api/src/server.ts`
- **Auth**: reads session cookie via `auth.api.getSession()`
- **Body**: `{ message: string, history: Array<{role, content}> }`
- **Flow**: builds RAG context → `chatCompletionStream` → returns `ReadableStream` with `data: {"token":"..."}\n\n` chunks, ending with `data: [DONE]\n\n`
- **Client**: `apps/web/src/app/(dashboard)/assistant/page.tsx` uses `fetch` + `ReadableStream` (not tRPC)

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
| Orient yourself / find context | [@.claude/skills/navigate-codebase](/.claude/skills/navigate-codebase/SKILL.md) |
| Add a field to a table | [@.claude/skills/add-field](/.claude/skills/add-field/SKILL.md) |
| Add a tRPC endpoint | [@.claude/skills/new-api-endpoint](/.claude/skills/new-api-endpoint/SKILL.md) |
| Create a UI view | [@.claude/skills/new-view](/.claude/skills/new-view/SKILL.md) |
| Expose a tool to AI | [@.claude/skills/new-mcp-tool](/.claude/skills/new-mcp-tool/SKILL.md) |
| Build a full module | [@.claude/skills/new-module](/.claude/skills/new-module/SKILL.md) |
| Add an automation | [@.claude/skills/new-automation-trigger](/.claude/skills/new-automation-trigger/SKILL.md) |
| Write tests | [@.claude/skills/testing-patterns](/.claude/skills/testing-patterns/SKILL.md) |
| Architecture decision | [@.claude/skills/architecture](/.claude/skills/architecture/SKILL.md) |
| UI component patterns | [@.claude/skills/ui-components](/.claude/skills/ui-components/SKILL.md) |

## Running Locally

```bash
pnpm dev:setup                        # first-time: generates .env, starts Docker, seeds demo data
pnpm --filter @basicsos/api dev       # API server on :3001
pnpm --filter @basicsos/web dev       # Web portal on :3000
pnpm --filter @basicsos/desktop dev   # Desktop app (requires web on :3000)
pnpm test                             # run all tests (197 passing)
npx vitest run                        # integration + security tests
node run-migration.cjs                # run pending DB migrations
```

**Required env vars** (see `.env.example`):
- `DATABASE_URL`, `REDIS_URL` — Postgres + Redis (Docker via `pnpm dev:setup`)
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` — auth system

**Optional env vars for features:**
- `AI_API_KEY` or `ANTHROPIC_API_KEY` — AI features (assistant, summaries, embeddings)
- `DEEPGRAM_API_KEY` — meeting transcription
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_TEAM` — billing
- `SLACK_CLIENT_ID`/`SECRET`, `GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET` — Hub OAuth
- `OAUTH_ENCRYPTION_KEY` — 64 hex chars for AES-256-GCM token encryption

## Agents & Automation

Claude Code agents in `.claude/agents/` extend your workflow:

- **feature-builder** — builds a full module end-to-end from a description
- **module-creator** — scaffolds schema + router + UI + tests
- **code-reviewer** — reviews changes: PASS / CONCERNS / BLOCK
- **test-runner** — writes and runs tests for a given file
- **security-auditor** — OWASP Top 10 audit before merging
- **debugger** — root cause analysis for errors and test failures
- **bug-fixer** — targeted fix for a reported bug

## Design System & Component Architecture

### Design Tokens

Color tokens are defined in two places:
- **Web/Desktop**: `packages/ui/src/tokens.css` — single source of truth imported by both apps
- **Mobile**: `apps/mobile/lib/tokens.ts` — mirrored constants for React Native (`colors`, `radius`, `shadows`, `nameToColor()`)

The palette uses **warm stone** (not cold gray). Brand color: `#6366f1` (indigo).

| Token | Tailwind class | Use |
|---|---|---|
| `--primary` | `bg-primary`, `text-primary` | Main action color (indigo-600) |
| `--primary-foreground` | `text-primary-foreground` | Text on primary background |
| `--destructive` | `bg-destructive` | Delete / error actions |
| `--success` | `bg-success` | Success states |
| `--warning` | `bg-warning` | Warning states |

**Rules:**
- **Never use `gray-*` Tailwind classes — always use `stone-*`** (warm palette)
- **Prefer semantic tokens** (`bg-primary`, `text-foreground`, `border-border`) over raw colors
- Never write `bg-indigo-600` or `bg-blue-600` — use `bg-primary`

Common stone usage:
- `stone-900` — primary text
- `stone-700` — section headings
- `stone-500` — secondary text
- `stone-400` — placeholder text, timestamps
- `stone-200` — default borders
- `stone-300` — strong borders
- `stone-100` — subtle backgrounds
- `stone-50` — app background, muted inputs

### Lucide Icons

All icons come from `lucide-react` (web/desktop) or `lucide-react-native` (mobile). Import curated re-exports from `@basicsos/ui`:

```ts
import { Sparkles, BookOpen, Users, CheckSquare, Video, Link2, Plus, Search } from "@basicsos/ui";
```

**Rule: never use emoji as icons — always use Lucide.** Common mappings:
- `Sparkles` — AI features
- `BookOpen` — knowledge base
- `Users` — CRM / team
- `CheckSquare` — tasks
- `Video` — meetings
- `Link2` — hub / links
- `MessageSquare` — chat / transcript

### Component Customization

Every component accepts a `className` prop merged via the `cn()` utility:
```ts
import { cn } from "@basicsos/ui";
```

- `Sidebar` accepts: `width`, `header`, `footer` slots
- `EmptyState` accepts: `className`, `iconClassName` for color overrides
- `Button` uses CVA variants — extend by adding new variants to `buttonVariants`
- Pattern: always use `cn(defaults, className)` for new components

### When Building New Features

```
1. Use <Card> for any bordered white container — never raw <div className="border bg-white">
2. Use <Button> for all actions — never raw <button> with inline styles
3. Use <Input> / <Label> for forms — never raw <input> / <label>
4. Use <Badge> for status indicators — never inline pill divs
5. Use <EmptyState> for empty lists — never inline empty messages
6. Use <Dialog> for modals — never custom modal divs
7. Colors: stone-900 (primary text), stone-500 (secondary), stone-400 (placeholder)
8. Borders: stone-200 (default), stone-300 (strong)
9. Surfaces: white (cards), stone-50 (app bg), stone-100 (subtle bg)
```

### Mobile Tokens

- `apps/mobile/lib/tokens.ts` — `colors`, `radius`, `shadows`, `nameToColor()`
- `apps/mobile/lib/auth-styles.ts` — shared auth screen StyleSheet
- `apps/mobile/components/Screen.tsx` — accepts `scrollable` prop

## UI Components

All reusable components live in `packages/ui/src/`. Import from `@basicsos/ui`.

```ts
import { Button, Input, Card, Dialog, Select, Badge, EmptyState, useToast, addToast } from "@basicsos/ui";
```

- **Button** — CVA variants: `default | destructive | outline | ghost | link`; sizes: `default | sm | lg | icon`
- **Input** — forwarded ref, `border-primary` focus ring
- **Card** — `Card + CardHeader + CardTitle + CardDescription + CardContent + CardFooter`
- **Badge** — CVA variants: `default | secondary | destructive | outline | success | warning`
- **Dialog** — `Dialog + DialogTrigger + DialogContent + DialogHeader + DialogTitle + DialogFooter`
- **Select** — `Select + SelectTrigger + SelectValue + SelectContent + SelectItem`
- **EmptyState** — `Icon` + `heading` + `description` + optional `action` slot
- **Toaster** — render `<Toaster />` once in root layout; call `addToast({ title, variant })` anywhere

### Form + Mutation + Toast pattern

```tsx
const MyDialog = (): JSX.Element => {
  const [open, setOpen] = useState(false);
  const mutate = trpc.myModule.create.useMutation({
    onSuccess: () => { addToast({ title: "Created!", variant: "success" }); setOpen(false); },
    onError: (err) => { addToast({ title: "Error", description: err.message, variant: "destructive" }); },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Create</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Item</DialogTitle></DialogHeader>
        {/* form fields */}
        <DialogFooter>
          <Button type="submit" onClick={() => mutate.mutate(...)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### "use client" rules
- Add to any component using hooks (`useState`, `useEffect`, `useRouter`, tRPC hooks)
- Radix-based components (`Dialog`, `Select`) have it built-in — consuming code may also need it
- Server components (`Card`, `Badge`, `Separator`, `Input`) do NOT need it

### Adding a new component
1. Install Radix dep in `packages/ui/package.json`
2. Create `packages/ui/src/components/MyComponent.tsx` (add `"use client"` if interactive)
3. Export from `packages/ui/src/index.ts`
4. Run `pnpm --filter @basicsos/ui build`

See: [@.claude/skills/ui-components](/.claude/skills/ui-components/SKILL.md)

## Auth in Web

- **Server routes**: Better Auth handler is mounted at `/api/auth/*` via `apps/web/src/app/api/auth/[...all]/route.ts`
- **Client**: `apps/web/src/lib/auth-client.ts` exports `authClient` (Better Auth browser client)
- **Session hook**: `authClient.useSession()` — returns `{ data: session, isPending }`
- **Auth context**: `useAuth()` from `@/providers/AuthProvider` — provides `{ user, session }`
- **Route protection**: `apps/web/src/middleware.ts` — redirects unauthenticated users to `/login`
- **tRPC auth**: `credentials: "include"` on `httpBatchLink` sends session cookies to API server

```ts
// Sign in
await authClient.signIn.email({ email, password });
// Sign up
await authClient.signUp.email({ name, email, password });
// Sign out
await authClient.signOut();
// Read session
const { user } = useAuth();
```

## Auth in Mobile

- **Auth client**: `apps/mobile/lib/auth-client.ts` — points to `EXPO_PUBLIC_APP_URL` (web app)
- **Token storage**: `expo-secure-store` → key `auth_token`
- **tRPC auth**: Bearer token in `Authorization` header via `TRPCProvider`
- **Auth guard**: `apps/mobile/app/_layout.tsx` checks for stored token on mount; redirects to `/(auth)/login`

## Auth in Desktop

- **Main window**: loads the web app directly — session cookie is set by Better Auth in the Electron `session.defaultSession`, same as a browser
- **Overlay**: runs a local React renderer (no web cookies). Auth via IPC:
  1. Overlay calls `window.electronAPI.getSessionToken()`
  2. Preload bridge invokes `ipcMain.handle("get-session-token")` which reads `better-auth.session_token` from `session.defaultSession.cookies`
  3. Overlay sends the token as `Authorization: Bearer <token>` to the API server
- **Preload bridge**: `window.electronAPI` exposes `send`, `injectText`, `captureScreen`, `getSessionToken`, `getApiUrl`

## Desktop App

Electron v33 desktop app at `apps/desktop/`, built with **electron-vite**.

### Window Architecture

| Window | Size | Content | Auth |
|--------|------|---------|------|
| **Main** | 1280x800 | Loads web app (`BASICOS_URL`) | Session cookie (same as browser) |
| **Overlay** | 420x480 | Local React renderer (electron-vite) | IPC cookie extraction → Bearer token |

- Overlay: frameless, transparent, always-on-top, `vibrancy: "under-window"`, visible on all workspaces
- Toggle: `Cmd+Shift+Space` (macOS) / `Ctrl+Shift+Space` (Windows/Linux)
- Overlay tabs: Ask (AI chat), Meetings (quick-join), Voice (Web Speech API dictation)

### Running

```bash
# Requires web app on :3000
pnpm --filter @basicsos/desktop dev     # electron-vite dev (HMR for overlay)
pnpm --filter @basicsos/desktop build   # electron-vite build
pnpm --filter @basicsos/desktop package # electron-builder → .dmg/.exe
```

### Branding & Auto-Updates

- On `app.whenReady()`, fetches `GET ${WEB_URL}/api/branding` → `{ companyName, logoUrl, accentColor, apiUrl, mcpUrl }`. Cached locally, falls back to defaults on error.
- Auto-updater: `electron-updater` checks for updates on startup (packaged builds only). Tray menu includes "Check for Updates".

### Key IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `get-session-token` | Renderer → Main | Extract session cookie for API auth |
| `get-api-url` | Renderer → Main | Get API server URL |
| `inject-text` | Renderer → Main | Clipboard + simulated paste into active field |
| `capture-screen` | Renderer → Main | Screenshot → base64 PNG |
| `set-ignore-mouse` | Renderer → Main | Click-through mode for overlay |
| `navigate-main` | Renderer → Main | Load URL in main window |

See: [context/platforms/desktop.context.md](context/platforms/desktop.context.md)

## Dashboard Layout (Web)

Pattern: **server layout → client nav child**

- `layout.tsx` (server) — renders `<NavClient />` + `<main>{children}</main>`
- `NavClient.tsx` (client) — uses `usePathname()` for active state, `useAuth()` for user widget

## Route Protection

Dashboard routes are protected by `apps/web/src/middleware.ts`. Public paths:
- `/login`, `/register`, `/invite/*` — always public
- `/api/*` — bypasses middleware
- All other paths require `better-auth.session_token` cookie

## Billing & Subscriptions

Stripe-powered billing lives in `packages/api/src/routers/billing.ts`.

| Procedure | Access | What it does |
|-----------|--------|-------------|
| `getSubscription` | `protectedProcedure` | Returns current plan + subscription state |
| `createCheckoutSession` | `adminProcedure` | Creates Stripe Checkout for starter/team plan |
| `createPortalSession` | `adminProcedure` | Opens Stripe Customer Portal for self-service |

- **DB**: `subscriptions` table tracks `stripeCustomerId`, `stripeSubscriptionId`, `plan`, `status` per tenant
- **Webhook**: `apps/web/src/app/api/webhooks/stripe/route.ts` handles `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated/deleted`
- **Env vars**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_TEAM`

## LiteLLM Proxy & Virtual Keys

Enables tenants to use a single managed API key for all LLM providers.

- **Router**: `packages/api/src/routers/llm-keys.ts` — `list`, `create`, `setActive`, `delete` (all `adminProcedure`)
- **DB**: `virtualKeys` table — stores SHA-256 hash + 12-char prefix (`bos_live_sk_...`), rate limits, budget. Full key is returned only once on creation.
- **Proxy endpoint**: `POST /v1/chat/completions` in `server.ts` — OpenAI-compatible. Auth via `Authorization: Bearer bos_live_sk_...`, validated by `validateVirtualKey()`. Calls `chatCompletion()` with `featureName: "llm-proxy"` telemetry. Returns OpenAI-compatible response envelope.

## Hub OAuth Integrations

Hub connects third-party services via OAuth. Code in `packages/api/src/routers/hub.ts`.

| Procedure | What it does |
|-----------|-------------|
| `getOAuthUrl` | Builds authorization URL with CSRF state param |
| `storeOAuthToken` | Encrypts + stores access/refresh tokens |
| `disconnectIntegration` | Removes integration |
| `getDecryptedToken` | Decrypts stored token for API calls |
| `listIntegrations` | Returns connected/configured status for each service |

- **Supported services**: Slack, Google Drive, GitHub
- **Callback route**: `apps/web/src/app/api/oauth/[service]/callback/route.ts`
- **Encryption**: AES-256-GCM in `packages/api/src/lib/oauth-encrypt.ts`. Key: `OAUTH_ENCRYPTION_KEY` env var (64 hex chars). Falls back to `UNENCRYPTED:` prefix if key not configured.
- **Service env vars**: `SLACK_CLIENT_ID`/`SECRET`, `GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET`

## Push Notifications

Mobile push notifications via Expo Push API.

- **DB**: `pushTokens` table — `userId`, `tenantId`, `token` (unique Expo push token), `platform` (ios/android)
- **Registration**: `auth.registerPushToken` / `auth.unregisterPushToken` (both `protectedProcedure`)
- **Sending**: `notification.worker.ts` — persists in-app notification, then sends push to all user tokens. Auto-cleans stale `DeviceNotRegistered` tokens.
- **Triggers**: meeting processor sends push when summary is ready; any worker can call `sendNotification()` helper

## Module Config

Per-tenant module enable/disable in `packages/api/src/routers/modules.ts`.

Built-in modules (with defaults): `knowledge` (on), `crm` (on), `tasks` (on), `meetings` (on), `hub` (on), `ai-employees` (off), `automations` (off).

| Procedure | Access | What it does |
|-----------|--------|-------------|
| `list` | `protectedProcedure` | All modules with effective enabled state |
| `getStatus` | `protectedProcedure` | Single module status |
| `setEnabled` | `adminProcedure` | Upserts `moduleConfig` (toggle on/off) |

Admin UI at `/admin/modules`.

## Admin Panel

Admin-only pages under `apps/web/src/app/(dashboard)/admin/`:

| Route | What it does |
|-------|-------------|
| `/admin/team` | Invite members, manage roles, deactivate users |
| `/admin/modules` | Enable/disable modules per tenant |
| `/admin/usage` | LLM spend breakdown by model, user, feature |
| `/admin/security` | Immutable audit log trail |
| `/admin/branding` | Company name, logo URL, accent color |
| `/admin/mcp` | MCP server status, tool permissions |

Usage analytics and audit log queries live in `packages/api/src/routers/admin.ts`.

## Deployment

### Railway (recommended)

One-click deploy via `infra/railway/template.json`:

```bash
# Or manual deploy:
railway up
```

- `railway.toml` defines two services: `web` (port 3000) and `api` (port 3001)
- Template auto-provisions PostgreSQL 16 (pgvector) + Redis plugins
- `BETTER_AUTH_SECRET` and `OAUTH_ENCRYPTION_KEY` are auto-generated
- AI/billing/OAuth keys are optional — features degrade gracefully

### Docker (self-hosted)

```bash
docker-compose up                # dev: Postgres + Redis only
docker-compose -f docker-compose.prod.yml up  # prod: full stack
```

### Deployment Modes

| Mode | Cost | What you manage |
|------|------|----------------|
| Self-hosted (free) | $0 | Everything — your infra, your keys |
| Self-hosted + managed AI key | $29-99/mo | Your infra, we provide AI API key |
| Fully managed | $99-499/mo | We host everything |

## All Routers

The 14 routers registered in `packages/api/src/routers/index.ts`:

| Router | Key procedures | Docs in |
|--------|---------------|---------|
| `auth` | `me`, `onboard`, `registerPushToken` | Auth in Web/Mobile/Desktop sections |
| `knowledge` | `list`, `create`, `search` | `context/modules/knowledge-base.context.md` |
| `tasks` | `list`, `create`, `update`, `delete` | `context/modules/task-manager.context.md` |
| `crm` | contacts/companies/deals CRUD | `context/modules/crm.context.md` |
| `meetings` | `list`, `create`, transcripts, summaries | `context/modules/meeting-notes.context.md` |
| `search` | `global` — cross-module full-text + vector search | `context/architecture.context.md` |
| `assistant` | `chat`, `history` — non-streaming AI chat | Streaming AI section above |
| `modules` | `list`, `getStatus`, `setEnabled` | Module Config section |
| `automations` | CRUD + `automationRuns` | `context/modules/ai-employees.context.md` |
| `hub` | links CRUD + OAuth flows | Hub OAuth Integrations section |
| `aiEmployees` | `create`, `approve`, `reject`, jobs | `context/modules/ai-employees.context.md` |
| `admin` | usage stats, audit log, team mgmt | Admin Panel section |
| `billing` | checkout, portal, subscription state | Billing & Subscriptions section |
| `llmKeys` | virtual key CRUD + validation | LiteLLM Proxy section |

## Context File Map

All context files live in `context/`. Read these for deep dives into specific areas.

| File | What it covers |
|------|---------------|
| **Architecture & Conventions** | |
| `context/architecture.context.md` | System design, data flow, tech stack decisions |
| `context/conventions.context.md` | Code style, naming, file organization rules |
| `context/ui-components.context.md` | UI component library patterns and usage |
| **Infrastructure** | |
| `context/infrastructure/auth.context.md` | Better Auth setup, RBAC, session handling |
| `context/infrastructure/database.context.md` | Drizzle schema, RLS, migrations, pgvector |
| `context/infrastructure/deployment.context.md` | Railway, Docker, CI/CD pipeline |
| **Platforms** | |
| `context/platforms/web.context.md` | Next.js 15 app router, middleware, SSR |
| `context/platforms/desktop.context.md` | Electron + electron-vite, overlay, IPC |
| `context/platforms/mobile.context.md` | Expo SDK 54, auth, navigation |
| `context/platforms/mcp.context.md` | MCP server, tool registration, system caller |
| **Modules** | |
| `context/modules/knowledge-base.context.md` | Documents, embeddings, RAG search |
| `context/modules/crm.context.md` | Contacts, companies, deals, pipeline |
| `context/modules/task-manager.context.md` | Tasks, Kanban, assignments |
| `context/modules/meeting-notes.context.md` | Meetings, transcripts, AI summaries |
| `context/modules/hub.context.md` | Links, OAuth integrations |
| `context/modules/ai-employees.context.md` | Autonomous AI jobs, approval workflow |

## What Not to Do

- Don't add default exports (breaks tree-shaking + Claude Code conventions)
- Don't use `any` — use `unknown` with type guards
- Don't filter by `tenant_id` manually — RLS handles it
- Don't hardcode secrets — use `process.env["VAR"]` with fail-fast guard
- Don't add third-party billing or hosting provider integrations — this repo focuses on the product itself
- Don't modify `main` branch directly — always use feature branches (or worktrees for autonomous agents)
