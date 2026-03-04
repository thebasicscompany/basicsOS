---
name: backend-dev
description: Coding practices for backend development in Basics CRM. Use when deciding whether backend logic is needed, or when creating/modifying database migrations, Drizzle schema, Hono routes, or Better Auth configuration.
---

Backend logic runs in `packages/server` using Node + Hono REST API, Drizzle ORM, PostgreSQL, and Better Auth.

**Stack:**
- **API**: Hono (`/api/*` routes)
- **DB**: Drizzle ORM + PostgreSQL (schema in `packages/server/src/db/`)
- **Auth**: Better Auth (session-based)

**When adding backend logic:**
- **New tables/columns**: Add to Drizzle schema, then `pnpm db:generate` and `pnpm db:migrate`
- **Read optimizations**: Create a Drizzle view or query helper; expose via a Hono route
- **Complex mutations**: Add a Hono route handler; use Drizzle transactions for multi-table writes
- **Auth-protected routes**: Use Better Auth middleware to require a session

**Conventions:**
- Migrations live in `packages/server/drizzle/`
- API routes are organized by domain (e.g. `views`, `records`, `gateway-chat`)
- DB is passed to route creators from `createApp(db, env)`; route handlers receive it via closure. Follow existing patterns in `routes/` and `data-access/` for queries and mutations
