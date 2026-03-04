import { pgTable, bigserial, varchar, boolean, jsonb, timestamp, bigint, uuid, } from "drizzle-orm/pg-core";
import { crmUsers } from "./crm_users.js";
import { organizations } from "./organizations.js";
export const automationRules = pgTable("automation_rules", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    crmUserId: bigint("crm_user_id", { mode: "number" })
        .notNull()
        .references(() => crmUsers.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    workflowDefinition: jsonb("workflow_definition").notNull().default({}),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
