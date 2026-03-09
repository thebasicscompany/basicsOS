import {
  pgTable,
  bigserial,
  uuid,
  varchar,
  smallint,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations.js";

export const suggestedContacts = pgTable(
  "suggested_contacts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: varchar("email", { length: 512 }).notNull(),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    domain: varchar("domain", { length: 255 }),
    companyName: varchar("company_name", { length: 255 }),
    score: smallint("score").default(0).notNull(),
    signals: jsonb("signals")
      .$type<{
        isBidirectional: boolean;
        emailCount: number;
        threadCount: number;
        hasSignature: boolean;
        domainType: "business" | "personal" | "unknown";
        latestInteraction: string | null;
        hasBulkHeaders: boolean;
        senderNameQuality: "full_name" | "partial" | "automated" | "none";
      }>()
      .default({
        isBidirectional: false,
        emailCount: 0,
        threadCount: 0,
        hasSignature: false,
        domainType: "unknown",
        latestInteraction: null,
        hasBulkHeaders: false,
        senderNameQuality: "none",
      })
      .notNull(),
    status: varchar("status", { length: 16 }).default("pending").notNull(),
    emailCount: integer("email_count").default(0).notNull(),
    lastEmailDate: timestamp("last_email_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("suggested_contacts_org_email_idx").on(
      t.organizationId,
      t.email,
    ),
    index("suggested_contacts_org_status_score_idx").on(
      t.organizationId,
      t.status,
      t.score,
    ),
    index("suggested_contacts_org_status_idx").on(t.organizationId, t.status),
  ],
);
