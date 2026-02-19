# Skill: Create a New Module

## When to Use
Building a complete new business tool that integrates across all layers of Basics OS.

## Fastest Path: Code Generator

```bash
pnpm gen:module
```

Prompts for name, description, fields → scaffolds all 5 layers automatically.

## Manual Path: 5 Layers

### Layer 1: Database Schema
Create `packages/db/src/schema/[name].ts`:
```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const myItems = pgTable("my_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Export from `packages/db/src/schema/index.ts`. Run `pnpm db:generate && pnpm db:migrate`.

### Layer 2: Validators
Create `packages/shared/src/validators/[name].ts`:
```ts
import { z } from "zod";
export const insertMyItemSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
});
export const updateMyItemSchema = insertMyItemSchema.partial().omit({ tenantId: true });
export type InsertMyItem = z.infer<typeof insertMyItemSchema>;
```

Export from `packages/shared/src/validators/index.ts`.

### Layer 3: tRPC Router
Create `packages/api/src/routers/[name].ts` with list/get/create/update/delete.
See [@.claude/skills/new-api-endpoint](../new-api-endpoint/SKILL.md) for patterns.

Add to `packages/api/src/routers/index.ts`:
```ts
import { myItemsRouter } from "./my-items.js";
export const appRouter = router({ ..., myItems: myItemsRouter });
```

### Layer 4: UI Pages
Create `apps/web/src/app/(dashboard)/[name]/page.tsx`.
See [@.claude/skills/new-view](../new-view/SKILL.md) for patterns.

Add to sidebar in `apps/web/src/app/(dashboard)/NavClient.tsx` — add entry to `NAV_ITEMS` array.

### Layer 5: Context File
Create `context/modules/[name].context.md` explaining:
- What the module is for
- Key tables
- tRPC router paths
- Important business rules
- File locations

## Registering in the Module System

Add to `BUILT_IN_MODULES` in `packages/api/src/routers/modules.ts`:
```ts
{ name: "my-items", displayName: "My Items", description: "...", icon: "Package", activeByDefault: true }
```

## Adding an MCP Tool
See [@.claude/skills/new-mcp-tool](../new-mcp-tool/SKILL.md).

## Checklist
- [ ] Schema table created and migrated
- [ ] Zod validators created (insert + update)
- [ ] tRPC router with CRUD + events
- [ ] Router added to appRouter index
- [ ] Web portal page created
- [ ] Added to sidebar navigation
- [ ] Added to module registry
- [ ] Context file created
- [ ] (Optional) MCP tool registered
- [ ] Tests written
