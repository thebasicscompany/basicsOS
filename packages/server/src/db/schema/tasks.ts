import {
  pgTable,
  bigserial,
  varchar,
  text,
  timestamp,
  bigint,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { contacts } from "@/db/schema/contacts.js";
import { companies } from "@/db/schema/companies.js";
import { crmUsers } from "@/db/schema/crm_users.js";
import { organizations } from "@/db/schema/organizations.js";

export const tasks = pgTable(
  "tasks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    contactId: bigint("contact_id", { mode: "number" }).references(
      () => contacts.id,
      { onDelete: "cascade" },
    ),
    companyId: bigint("company_id", { mode: "number" }).references(
      () => companies.id,
      { onDelete: "set null" },
    ),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(
      () => crmUsers.id,
    ),
    assigneeId: bigint("assignee_id", { mode: "number" }).references(
      () => crmUsers.id,
    ),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 64 }),
    text: text("text"),
    description: text("description"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    doneDate: timestamp("done_date", { withTimezone: true }),
  },
  (t) => [
    index("tasks_contact_id_idx").on(t.contactId),
    index("tasks_company_id_idx").on(t.companyId),
    index("tasks_crm_user_id_idx").on(t.crmUserId),
    index("tasks_org_idx").on(t.organizationId),
  ],
);
