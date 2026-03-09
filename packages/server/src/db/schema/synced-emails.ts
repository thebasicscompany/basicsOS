import {
  pgTable,
  bigserial,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations.js";

export const syncedEmails = pgTable(
  "synced_emails",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    gmailMessageId: varchar("gmail_message_id", { length: 64 }).notNull(),
    gmailThreadId: varchar("gmail_thread_id", { length: 64 }),
    subject: text("subject"),
    snippet: text("snippet"),
    bodyText: text("body_text"),
    fromEmail: varchar("from_email", { length: 512 }).notNull(),
    fromName: varchar("from_name", { length: 512 }),
    toAddresses: jsonb("to_addresses")
      .$type<{ email: string; name?: string }[]>()
      .default([])
      .notNull(),
    ccAddresses: jsonb("cc_addresses")
      .$type<{ email: string; name?: string }[]>()
      .default([])
      .notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    isRead: boolean("is_read").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("synced_emails_org_msg_idx").on(
      t.organizationId,
      t.gmailMessageId,
    ),
    index("synced_emails_org_date_idx").on(t.organizationId, t.date),
    index("synced_emails_org_from_idx").on(t.organizationId, t.fromEmail),
  ],
);
