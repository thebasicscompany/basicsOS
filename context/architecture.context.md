# Basics OS Architecture

## Overview
Basics OS is a monorepo that companies clone to get a complete internal OS: knowledge system, CRM, meetings, automations, AI employees, and an always-present AI assistant. Five platform targets from one codebase.

## Monorepo Structure
```
basicos/
├── apps/
│   ├── web/           # Next.js 15 web portal
│   ├── desktop/       # Electron v33 desktop app
│   ├── mobile/        # Expo SDK 54 mobile app
│   └── mcp/
│       ├── company/   # Company MCP server (@modelcontextprotocol/sdk)
│       └── engineer/  # Engineer MCP server
├── packages/
│   ├── api/           # tRPC v11 + Hono v4 backend
│   ├── db/            # Drizzle v0.44 ORM + schema
│   ├── auth/          # Better Auth v1
│   ├── ui/            # Shared React components (Radix + Tailwind v4)
│   ├── shared/        # Types, validators (Zod), utilities
│   ├── sync/          # Yjs CRDTs + Hocuspocus
│   └── config/        # Shared TS/ESLint/Prettier/Tailwind configs
└── context/           # AI context files for all coding tools
```

## Key Architectural Decisions
| Layer | Choice | Reason |
|-------|--------|--------|
| Monorepo | Turborepo + pnpm 9 | 3x faster than Nx, proven at Cal.com/Supabase |
| Backend | tRPC v11 + Hono v4 | End-to-end type safety, 3x faster than Express |
| Database | PostgreSQL (Neon) + Turso SQLite | Cloud + offline-first local replica |
| ORM | Drizzle v0.44 | Code-first TypeScript, 7.4KB bundle |
| Auth | Better Auth v1 | Open-source, multi-platform, Drizzle adapter |
| Real-time | Yjs v13 CRDTs | Used by Notion, conflict-free collaboration |
| AI client | OpenAI-compatible | Works with any OpenAI-compatible API endpoint |
| Desktop | Electron v33 | Only framework with mature overlay + desktopCapturer |
| Mobile | Expo SDK 54 | Official RN recommendation, no Xcode config |

## Data Flow
All platforms → single tRPC API server → single PostgreSQL database
Company MCP server imports appRouter directly (no HTTP hop)
Events → Event Bus (EventEmitter) → BullMQ workers → side effects
