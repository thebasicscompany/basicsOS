import { pgTable, bigserial, varchar, text, jsonb, timestamp, bigint, uuid, index, } from "drizzle-orm/pg-core";
import { crmUsers } from "../../db/schema/crm_users";
import { organizations } from "../../db/schema/organizations";
export const companies = pgTable("companies", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    domain: varchar("domain", { length: 512 }),
    description: text("description"),
    category: varchar("category", { length: 255 }),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(() => crmUsers.id),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    customFields: jsonb("custom_fields")
        .$type()
        .default({})
        .notNull(),
}, (t) => [
    index("companies_crm_user_id_idx").on(t.crmUserId),
    index("companies_org_idx").on(t.organizationId),
    index("companies_category_idx").on(t.category),
]);
