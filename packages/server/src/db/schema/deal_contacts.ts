import {
  bigserial,
  bigint,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { deals } from "@/db/schema/deals.js";
import { contacts } from "@/db/schema/contacts.js";
import { organizations } from "@/db/schema/organizations.js";
import { crmUsers } from "@/db/schema/crm_users.js";

export const dealContacts = pgTable(
  "deal_contacts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    dealId: bigint("deal_id", { mode: "number" })
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    contactId: bigint("contact_id", { mode: "number" })
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(
      () => crmUsers.id,
      {
        onDelete: "cascade",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("deal_contacts_unique").on(t.dealId, t.contactId),
    index("deal_contacts_deal_idx").on(t.dealId),
    index("deal_contacts_contact_idx").on(t.contactId),
    index("deal_contacts_org_idx").on(t.organizationId),
  ],
);
