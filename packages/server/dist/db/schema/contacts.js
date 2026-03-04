import { pgTable, bigserial, varchar, text, boolean, timestamp, bigint, uuid, jsonb, index, } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { crmUsers } from "./crm_users";
import { organizations } from "./organizations";
export const contacts = pgTable("contacts", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    gender: varchar("gender", { length: 32 }),
    title: varchar("title", { length: 255 }),
    email: text("email"), // legacy; email_jsonb used
    emailJsonb: jsonb("email_jsonb"), // [{ email, type }]
    phoneJsonb: jsonb("phone_jsonb"), // [{ number, type }]
    background: text("background"),
    avatar: jsonb("avatar"), // { src: string }
    firstSeen: timestamp("first_seen", { withTimezone: true }),
    lastSeen: timestamp("last_seen", { withTimezone: true }),
    hasNewsletter: boolean("has_newsletter"),
    status: varchar("status", { length: 64 }),
    tags: jsonb("tags").$type(),
    companyId: bigint("company_id", { mode: "number" }).references(() => companies.id, {
        onDelete: "cascade",
    }),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(() => crmUsers.id),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    linkedinUrl: varchar("linkedin_url", { length: 512 }),
    customFields: jsonb("custom_fields").$type().default({}).notNull(),
}, (t) => [
    index("contacts_crm_user_id_idx").on(t.crmUserId),
    index("contacts_org_idx").on(t.organizationId),
    index("contacts_company_id_idx").on(t.companyId),
    index("contacts_status_idx").on(t.status),
]);
