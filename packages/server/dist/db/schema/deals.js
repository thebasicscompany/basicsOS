import { pgTable, bigserial, varchar, text, bigint, smallint, timestamp, jsonb, uuid, index, } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { crmUsers } from "./crm_users";
import { organizations } from "./organizations";
export const deals = pgTable("deals", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    companyId: bigint("company_id", { mode: "number" }).references(() => companies.id),
    contactIds: jsonb("contact_ids").$type(),
    category: varchar("category", { length: 128 }),
    stage: varchar("stage", { length: 128 }).notNull(),
    description: text("description"),
    amount: bigint("amount", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    expectedClosingDate: timestamp("expected_closing_date", { withTimezone: true }),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(() => crmUsers.id),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    index: smallint("index"),
    customFields: jsonb("custom_fields").$type().default({}).notNull(),
}, (t) => [
    index("deals_crm_user_id_idx").on(t.crmUserId),
    index("deals_org_idx").on(t.organizationId),
    index("deals_company_id_idx").on(t.companyId),
    index("deals_stage_idx").on(t.stage),
    index("deals_category_idx").on(t.category),
]);
