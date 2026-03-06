import {
  pgTable,
  bigserial,
  varchar,
  text,
  bigint,
  uuid,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "@/db/schema/companies";
import { crmUsers } from "@/db/schema/crm_users";
import { organizations } from "@/db/schema/organizations";

export const contacts = pgTable(
  "contacts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    email: text("email"),
    companyId: bigint("company_id", { mode: "number" }).references(
      () => companies.id,
      {
        onDelete: "cascade",
      },
    ),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(
      () => crmUsers.id,
    ),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    linkedinUrl: varchar("linkedin_url", { length: 512 }),
    customFields: jsonb("custom_fields")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
  },
  (t) => [
    index("contacts_crm_user_id_idx").on(t.crmUserId),
    index("contacts_org_idx").on(t.organizationId),
    index("contacts_company_id_idx").on(t.companyId),
  ],
);
