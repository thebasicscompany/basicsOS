import {
  pgTable,
  bigserial,
  uuid,
  bigint,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations.js";
import { crmUsers } from "@/db/schema/crm_users.js";

export const emailSyncState = pgTable(
  "email_sync_state",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(
      () => crmUsers.id,
      { onDelete: "cascade" },
    ),
    historyId: text("history_id"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncStatus: varchar("sync_status", { length: 32 })
      .default("idle")
      .notNull(),
    totalSynced: integer("total_synced").default(0).notNull(),
    errorMessage: text("error_message"),
    settings: jsonb("settings")
      .$type<{
        syncPeriodDays: number;
        enrichWithAi: boolean;
        autoAcceptThreshold: number | null;
      }>()
      .default({
        syncPeriodDays: 90,
        enrichWithAi: true,
        autoAcceptThreshold: null,
      })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("email_sync_state_org_idx").on(t.organizationId)],
);
