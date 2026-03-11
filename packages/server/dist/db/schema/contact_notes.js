import { pgTable, bigserial, varchar, text, timestamp, bigint, uuid, jsonb, index, } from "drizzle-orm/pg-core";
import { contacts } from "@/db/schema/contacts.js";
import { crmUsers } from "@/db/schema/crm_users.js";
import { organizations } from "@/db/schema/organizations.js";
export const contactNotes = pgTable("contact_notes", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    contactId: bigint("contact_id", { mode: "number" })
        .notNull()
        .references(() => contacts.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }),
    text: text("text"),
    date: timestamp("date", { withTimezone: true }).defaultNow(),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(() => crmUsers.id, {
        onDelete: "cascade",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    status: varchar("status", { length: 64 }),
    attachments: jsonb("attachments").$type(),
}, (t) => [
    index("contact_notes_contact_id_idx").on(t.contactId),
    index("contact_notes_crm_user_id_idx").on(t.crmUserId),
    index("contact_notes_org_idx").on(t.organizationId),
]);
