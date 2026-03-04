import { pgTable, bigserial, varchar, text, smallint, json, jsonb, timestamp, bigint, uuid, index, } from "drizzle-orm/pg-core";
import { crmUsers } from "./crm_users";
import { organizations } from "./organizations";
export const companies = pgTable("companies", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    sector: varchar("sector", { length: 255 }),
    size: smallint("size"),
    linkedinUrl: varchar("linkedin_url", { length: 512 }),
    website: varchar("website", { length: 512 }),
    phoneNumber: varchar("phone_number", { length: 64 }),
    address: text("address"),
    zipcode: varchar("zipcode", { length: 32 }),
    city: varchar("city", { length: 128 }),
    stateAbbr: varchar("state_abbr", { length: 16 }),
    country: varchar("country", { length: 128 }),
    description: text("description"),
    revenue: varchar("revenue", { length: 64 }),
    taxIdentifier: varchar("tax_identifier", { length: 64 }),
    logo: jsonb("logo"), // { src: string }
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(() => crmUsers.id),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    contextLinks: json("context_links"),
    customFields: jsonb("custom_fields").$type().default({}).notNull(),
}, (t) => [
    index("companies_crm_user_id_idx").on(t.crmUserId),
    index("companies_org_idx").on(t.organizationId),
    index("companies_sector_idx").on(t.sector),
]);
