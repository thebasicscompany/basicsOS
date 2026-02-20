import { pgTable, uuid, text, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    triggerConfig: jsonb("trigger_config").notNull(),
    actionChain: jsonb("action_chain").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("automations_tenant_id_idx").on(t.tenantId),
    index("automations_enabled_idx").on(t.enabled),
  ],
);

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | running | completed | failed
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    result: jsonb("result"),
    error: text("error"),
  },
  (t) => [index("automation_runs_automation_id_idx").on(t.automationId)],
);
