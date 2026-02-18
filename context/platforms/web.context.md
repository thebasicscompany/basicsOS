# Web Portal Platform Context

## Overview
The Basics OS web portal is a Next.js 15 application (`apps/web`) that provides the primary browser-based interface for company operations.

## Tech Stack
- **Framework**: Next.js 15 with App Router
- **Runtime**: React 18 with server and client components
- **Data fetching**: tRPC v11 + TanStack Query v5 for type-safe API calls
- **Styling**: Tailwind CSS v4
- **Auth**: Better Auth (integration pending)

## Structure
- `src/app/(dashboard)/` — authenticated dashboard routes with sidebar layout
- `src/app/(auth)/` — unauthenticated auth routes (login, register, invite)
- `src/lib/trpc.ts` — tRPC React client factory
- `src/providers/TRPCProvider.tsx` — QueryClient + tRPC provider tree

## Key Decisions
- Route groups `(dashboard)` and `(auth)` separate layout concerns without affecting URL paths
- The Sidebar component lives in `@basicos/ui` so it can be shared with other apps
- `next/link` is not used in `@basicos/ui/Sidebar` to avoid coupling the UI package to Next.js; plain `<a>` tags are used instead
- tRPC client connects to `NEXT_PUBLIC_API_URL/trpc` via HTTP batch link

## Admin Panel
Admin pages under `(dashboard)/admin/` are stub placeholders. Access control (admin-only guard) will be implemented when Better Auth integration is complete.
