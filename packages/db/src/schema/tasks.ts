import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users, tenants } from "./tenants.js";

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo | in-progress | done
  priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
  assigneeId: uuid("assignee_id").references(() => users.id),
  dueDate: timestamp("due_date"),
  labels: jsonb("labels").notNull().default([]),
  sourceType: text("source_type"), // meeting | automation | ai-employee | null
  sourceId: uuid("source_id"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
