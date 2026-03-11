import { pgTable, bigserial, varchar, bigint, timestamp, jsonb, uuid, index, } from "drizzle-orm/pg-core";
import { companies } from "../../db/schema/companies.js";
import { crmUsers } from "../../db/schema/crm_users.js";
import { organizations } from "../../db/schema/organizations.js";
export const deals = pgTable("deals", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    companyId: bigint("company_id", { mode: "number" }).references(() => companies.id, { onDelete: "set null" }),
    status: varchar("status", { length: 128 }).notNull(),
    amount: bigint("amount", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(() => crmUsers.id),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    customFields: jsonb("custom_fields")
        .$type()
        .default({})
        .notNull(),
}, (t) => [
    index("deals_crm_user_id_idx").on(t.crmUserId),
    index("deals_org_idx").on(t.organizationId),
    index("deals_company_id_idx").on(t.companyId),
    index("deals_status_idx").on(t.status),
]);
