import {
  pgTable,
  bigserial,
  uuid,
  bigint,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations.js";
import { syncedEmails } from "@/db/schema/synced-emails.js";
import { contacts } from "@/db/schema/contacts.js";

export const emailContactLinks = pgTable(
  "email_contact_links",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    syncedEmailId: bigint("synced_email_id", { mode: "number" })
      .references(() => syncedEmails.id, { onDelete: "cascade" })
      .notNull(),
    contactId: bigint("contact_id", { mode: "number" })
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 8 }).default("from").notNull(),
  },
  (t) => [
    uniqueIndex("email_contact_links_unique_idx").on(
      t.syncedEmailId,
      t.contactId,
      t.role,
    ),
    index("email_contact_links_contact_idx").on(t.contactId),
    index("email_contact_links_email_idx").on(t.syncedEmailId),
  ],
);
