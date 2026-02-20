import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { users, tenants } from "./tenants";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("todo"), // todo | in-progress | done
    priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
    assigneeId: uuid("assignee_id").references(() => users.id),
    dueDate: timestamp("due_date"),
    labels: jsonb("labels").notNull().default([]),
    sourceType: text("source_type"), // meeting | automation | ai-employee | null
    sourceId: uuid("source_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("tasks_tenant_id_idx").on(t.tenantId),
    index("tasks_status_idx").on(t.status),
    index("tasks_assignee_id_idx").on(t.assigneeId),
    index("tasks_due_date_idx").on(t.dueDate),
  ],
);
