import { pgTable, bigserial, varchar, jsonb, timestamp, bigint, uuid, index } from "drizzle-orm/pg-core";
import { crmUsers } from "./crm_users.js";
import { organizations } from "./organizations.js";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(() => crmUsers.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entity_type", { length: 128 }),
    entityId: varchar("entity_id", { length: 128 }),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_logs_org_created_idx").on(t.organizationId, t.createdAt),
    index("audit_logs_user_created_idx").on(t.crmUserId, t.createdAt),
    index("audit_logs_action_idx").on(t.action),
  ]
);
