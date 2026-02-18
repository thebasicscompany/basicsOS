# Database — Infrastructure Context

## Stack
- **ORM**: Drizzle v0.44+ with `drizzle-orm/pg-core`
- **Database**: PostgreSQL 16 with pgvector extension (local: docker-compose, cloud: Neon)
- **Local replica**: Turso SQLite for offline-capable desktop/mobile features
- **Config**: `packages/db/drizzle.config.ts` → `packages/db/dist/schema/index.js`

## Schema Location
All tables are in `packages/db/src/schema/`:
- `tenants.ts` — tenants, users, sessions, invites
- `documents.ts` — documents, document_embeddings
- `crm.ts` — contacts, companies, deals, deal_activities, deal_activity_embeddings
- `meetings.ts` — meetings, meeting_participants, transcripts, meeting_summaries, meeting_embeddings
- `tasks.ts` — tasks
- `automations.ts` — automations, automation_runs
- `ai-employees.ts` — ai_employee_jobs, ai_employee_outputs
- `hub.ts` — hub_links, integrations
- `system.ts` — events, notifications, files, audit_log

## Row-Level Security (Critical)

**Every table has `tenant_id`. RLS policies enforce isolation automatically.**

The API middleware runs `SET LOCAL app.tenant_id = '<uuid>'` at the start of every request.
PostgreSQL RLS policies then filter every query to the current tenant.

```sql
-- Applied to every table
CREATE POLICY tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

**Result: you NEVER need to write `WHERE tenant_id = ?` in application code.**
Drizzle queries return only the current tenant's rows automatically.

## Adding a Table

```ts
// packages/db/src/schema/my-module.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const myTable = pgTable("my_table", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Then export from `packages/db/src/schema/index.ts` and run:
```bash
# Build TypeScript first (drizzle.config.ts reads from dist/), then push schema
DATABASE_URL="..." pnpm --filter @basicos/db migrate
```

## Adding a Field

```ts
// 1. Add to schema
myTable = pgTable("my_table", {
  ...,
  newField: text("new_field"),  // add here
});

// 2. Build + push schema to database (for local dev — fast, no SQL files)
DATABASE_URL="..." pnpm --filter @basicos/db migrate

// 3. (Optional) Generate SQL migration file for version-controlled history
DATABASE_URL="..." pnpm --filter @basicos/db generate

// 4. Update Zod validator in packages/shared/src/validators/
export const insertMySchema = z.object({
  ...,
  newField: z.string().optional(),
});
```

## Vector Embeddings

Embedding columns use pgvector: `vector("embedding", { dimensions: 1536 })`.
Search uses cosine similarity (`<=>` operator):
```sql
SELECT *, 1 - (embedding <=> '[...]'::vector) as score
FROM document_embeddings
WHERE tenant_id = current_setting('app.tenant_id')::uuid
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;
```

## Querying Patterns

```ts
// Single row — destructure the array
const [row] = await ctx.db.select().from(table).where(eq(table.id, id));
if (!row) throw new TRPCError({ code: "NOT_FOUND" });

// Multiple rows — return directly
return ctx.db.select().from(table).orderBy(desc(table.createdAt));

// Insert and return — always use .returning()
const [created] = await ctx.db.insert(table).values({ ... }).returning();
if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

// Update with tenant check
const [updated] = await ctx.db.update(table)
  .set({ field: value })
  .where(and(eq(table.id, id), eq(table.tenantId, ctx.tenantId)))
  .returning();
```

## Migration Commands

drizzle-kit 0.30.x cannot load ESM TypeScript files with `.js` imports directly.
The config (`drizzle.config.ts`) reads compiled output from `./dist/schema/index.js`,
so **TypeScript must be compiled before any drizzle-kit command is run.**
The package.json scripts handle this automatically with `tsc &&` prefixes.

```bash
# Workspace-level shortcuts (from repo root)
pnpm db:migrate     # build + push schema to DB (fast, no SQL files)
pnpm db:generate    # build + generate SQL migration file in migrations/
pnpm db:seed        # populate demo data (runs packages/db/src/seed.ts)
pnpm db:studio      # open Drizzle Studio visual DB browser

# Package-level scripts (equivalent, require DATABASE_URL in env)
DATABASE_URL="..." pnpm --filter @basicos/db migrate      # tsc && drizzle-kit push
DATABASE_URL="..." pnpm --filter @basicos/db generate     # tsc && drizzle-kit generate
DATABASE_URL="..." pnpm --filter @basicos/db migrate:sql  # tsc && generate && migrate
```

Migration SQL files are stored in `packages/db/migrations/` and should be
committed alongside schema changes for audit history.
