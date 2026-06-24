import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { crmUsers } from "@/db/schema/crm_users.js";
import { organizations } from "@/db/schema/organizations.js";

// App-contributed company knowledge (F2 keystone). When an app calls the broker
// `context.remember` tool — e.g. a daily-status app saving "Ada shipped the
// renewals dashboard", or a messaging app saving a decision — a row lands here AND
// the text is embedded into `context_embeddings` (entity_type "app_memory"). The
// agent's existing `memory.recall_context` then surfaces it, so EVERYTHING a
// company builds as an app becomes part of the context hermes reasons over. This
// table is the human-readable source of truth (for list/table views); the vector
// index is the recall path. Org-scoped + attributed to the acting user + app.
export const appMemory = pgTable(
  "app_memory",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    crmUserId: bigint("crm_user_id", { mode: "number" })
      .notNull()
      .references(() => crmUsers.id, { onDelete: "cascade" }),
    // the app slug that contributed this (or "agent" when the agent remembers).
    appSlug: varchar("app_slug", { length: 64 }).notNull(),
    title: varchar("title", { length: 256 }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("app_memory_org_created_idx").on(t.organizationId, t.createdAt),
    index("app_memory_org_app_idx").on(t.organizationId, t.appSlug),
  ],
);

export type AppMemoryRow = typeof appMemory.$inferSelect;
