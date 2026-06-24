import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  jsonb,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations.js";

// Per-app key/value storage for the bridge `storage.*` methods (APP-4b). Scoped by
// (org, app, scope) and additionally by user for scope "user". A hosted app runs
// at an opaque origin and has NO browser storage of its own, so this server-backed,
// org/app/user-scoped store is how an app persists state — and the host, not the
// app, decides the scope, so apps can't read each other's or another user's data.
export const appStorage = pgTable(
  "app_storage",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    appSlug: varchar("app_slug", { length: 64 }).notNull(),
    // "app" (shared across the company) | "user" (per acting user)
    scope: varchar("scope", { length: 16 }).notNull(),
    // null for scope "app"; the acting crm user id for scope "user"
    crmUserId: bigint("crm_user_id", { mode: "number" }),
    key: varchar("key", { length: 256 }).notNull(),
    value: jsonb("value"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("app_storage_lookup_idx").on(
      t.organizationId,
      t.appSlug,
      t.scope,
      t.crmUserId,
      t.key,
    ),
  ],
);

export type AppStorageRow = typeof appStorage.$inferSelect;
