import { pgTable, uuid, text, timestamp, boolean, numeric, index } from "drizzle-orm/pg-core";
import { users, tenants } from "./tenants";

export const aiEmployeeJobs = pgTable(
  "ai_employee_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull(),
    status: text("status").notNull().default("pending"),
    // pending | running | awaiting_approval | completed | failed | killed
    sandboxId: text("sandbox_id"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    costUsd: numeric("cost_usd", { precision: 8, scale: 4 }).notNull().default("0"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_employee_jobs_tenant_id_idx").on(t.tenantId),
    index("ai_employee_jobs_status_idx").on(t.status),
  ],
);

export const aiEmployeeOutputs = pgTable(
  "ai_employee_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => aiEmployeeJobs.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // text | file | action
    content: text("content").notNull(),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    approvedAt: timestamp("approved_at"),
    approvedBy: uuid("approved_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("ai_employee_outputs_job_id_idx").on(t.jobId)],
);
