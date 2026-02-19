# Basics OS

An open-source company operating system. Clone this repo to give your team a knowledge base, CRM, task manager, meeting intelligence, AI assistant, automations, and more — all running from one codebase.

## Deployment Options

### Option 1 — Managed (easiest)
**[basicsos.com](https://basicsos.com)** hosts Basics OS for you. One-click deploy, automatic updates, no infrastructure to manage. Includes a managed AI API key that covers all models (Claude, GPT-4, embeddings, speech) — no provider accounts needed.

### Option 2 — Self-hosted + Managed AI Key
Run Basics OS on your own infrastructure but use a managed AI key from [basicsos.com/keys](https://basicsos.com/keys) for the AI features. You handle the server, we handle the AI providers.

```bash
AI_API_KEY=bsk_live_...       # get at basicsos.com/keys
AI_API_URL=https://api.basicsos.com
```

### Option 3 — Fully self-hosted
Run everything yourself. Bring your own API keys from Anthropic, OpenAI, or any OpenAI-compatible provider.

```bash
ANTHROPIC_API_KEY=sk-ant-...  # or OPENAI_API_KEY=sk-...
```

---

## Quick Start (self-hosted)

```bash
# Prerequisites: Docker Desktop, Node.js 20+, pnpm 9+

git clone https://github.com/your-org/Basics OS
cd Basics OS
pnpm dev:setup
```

`pnpm dev:setup` handles everything: generates `.env`, starts PostgreSQL + Redis via Docker, builds packages, runs migrations, and seeds demo data.

Then open two terminals:

```bash
# Terminal 1 — API server (port 3001)
pnpm --filter @basicsos/api dev

# Terminal 2 — Web portal (port 3000)
pnpm --filter @basicsos/web dev
```

Open **http://localhost:3000**. Demo login: `admin@acme.example.com`.

---

## What's included

| Module | What it does |
|--------|-------------|
| 📚 Knowledge Base | Documents with rich text editing, nested pages, real-time collaboration |
| 🤝 CRM | Contacts, companies, deals pipeline, activity timeline |
| ✅ Tasks | Kanban board with priorities, assignees, and due dates |
| 🎯 Meetings | Transcript upload, AI summaries, auto-generated action items |
| 🤖 AI Assistant | RAG chat grounded in your company's actual data |
| ⚡ Automations | Event-driven workflows — "when X happens, do Y" |
| 🔗 Hub | Team links and integrations directory |
| 👥 AI Employees | Long-running AI agents with human approval gates |

---

## Architecture

Five platform targets from one codebase:

```
apps/
  web/           Next.js 15 — main web portal
  desktop/       Electron v33 — desktop app with overlay
  mobile/        Expo SDK 54 — iOS and Android
  mcp/company/   MCP server — connects AI tools to company data
  mcp/engineer/  MCP server — syncs Claude Code with team context

packages/
  api/           tRPC v11 + Hono v4 — single API for all platforms
  db/            Drizzle ORM — PostgreSQL schema with row-level security
  auth/          Better Auth — RBAC (admin / member / viewer)
  shared/        Zod validators and TypeScript types
  ui/            React components
  sync/          Yjs CRDTs for real-time document collaboration
```

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Monorepo | Turborepo + pnpm 9 |
| Backend | tRPC v11 + Hono v4 |
| Database | PostgreSQL 16 + pgvector |
| ORM | Drizzle v0.44 |
| Auth | Better Auth v1 |
| Web | Next.js 15 (App Router) |
| Desktop | Electron v33 |
| Mobile | Expo SDK 54 |
| Real-time | Yjs CRDTs + Hocuspocus |
| Events | Node EventEmitter + BullMQ |

---

## Platform targets

```bash
# Web portal
pnpm --filter @basicsos/web dev

# Electron desktop app (overlay, requires web on :3000)
cd apps/desktop && npx electron dist/main/index.js

# Mobile (Expo)
pnpm --filter @basicsos/mobile dev

# Company MCP server (for Claude, ChatGPT, Copilot)
MCP_TENANT_ID=<tenant-id> pnpm --filter @basicsos/mcp-company dev

# Engineer MCP server (for Claude Code)
REPO_ROOT=$PWD pnpm --filter @basicsos/mcp-engineer dev
```

---

## Environment variables

```bash
# ── Required ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://basicos:basicos_dev@localhost:5432/basicos
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=<run: openssl rand -hex 32>

# ── AI features — choose one ──────────────────────────────────────────────────

# Managed AI key (basicsos.com — covers all models, TTS, STT, embeddings)
# AI_API_KEY=bsk_live_...
# AI_API_URL=https://api.basicsos.com

# OR bring your own key
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...

# ── Optional ──────────────────────────────────────────────────────────────────
# RESEND_API_KEY=re_...         # email delivery for invites
# DEEPGRAM_API_KEY=...          # live meeting transcription
# NEXT_PUBLIC_COLLAB_URL=ws://localhost:4001   # real-time collaboration
```

Run `pnpm dev:setup` to auto-generate a `.env` with all required values.

---

## Commands

```bash
pnpm dev:setup      # First-time setup
pnpm db:migrate     # Apply database migrations
pnpm db:seed        # Reset demo data
pnpm db:studio      # Open Drizzle Studio
pnpm test           # Run all tests
pnpm gen:module     # Scaffold a new module
```

---

## Adding a module

```bash
pnpm gen:module     # prompts for name, fields → generates all 5 layers
```

See [CLAUDE.md](CLAUDE.md) for the full module development guide.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All development happens in feature branches.

## License

[AGPL-3.0](LICENSE) — free to self-host and modify. See the license for distribution terms.
