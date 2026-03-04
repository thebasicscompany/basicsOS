import { pgTable, bigserial, varchar, text, timestamp, bigint, uuid, index, } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { crmUsers } from "./crm_users";
import { organizations } from "./organizations";
export const tasks = pgTable("tasks", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    contactId: bigint("contact_id", { mode: "number" })
        .notNull()
        .references(() => contacts.id, { onDelete: "cascade" }),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(() => crmUsers.id),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    type: varchar("type", { length: 64 }),
    text: text("text"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    doneDate: timestamp("done_date", { withTimezone: true }),
}, (t) => [
    index("tasks_contact_id_idx").on(t.contactId),
    index("tasks_crm_user_id_idx").on(t.crmUserId),
    index("tasks_org_idx").on(t.organizationId),
]);
