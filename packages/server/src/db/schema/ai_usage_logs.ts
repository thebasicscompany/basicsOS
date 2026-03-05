import {
  pgTable,
  bigserial,
  varchar,
  uuid,
  bigint,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations.js";
import { crmUsers } from "@/db/schema/crm_users.js";

export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    crmUserId: bigint("crm_user_id", { mode: "number" })
      .notNull()
      .references(() => crmUsers.id, { onDelete: "cascade" }),
    feature: varchar("feature", { length: 30 }).notNull(),
    model: varchar("model", { length: 100 }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ai_usage_logs_org_created_idx").on(t.organizationId, t.createdAt),
    index("ai_usage_logs_user_created_idx").on(t.crmUserId, t.createdAt),
    index("ai_usage_logs_feature_idx").on(t.feature),
  ],
);
