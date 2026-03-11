import {
  pgTable,
  bigserial,
  varchar,
  text,
  timestamp,
  bigint,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { deals } from "@/db/schema/deals.js";
import { crmUsers } from "@/db/schema/crm_users.js";
import { organizations } from "@/db/schema/organizations.js";

export const dealNotes = pgTable(
  "deal_notes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    dealId: bigint("deal_id", { mode: "number" })
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }),
    type: varchar("type", { length: 64 }),
    text: text("text"),
    date: timestamp("date", { withTimezone: true }).defaultNow(),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(
      () => crmUsers.id,
    ),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    attachments:
      jsonb("attachments").$type<
        Array<{ url: string; name?: string; type?: string }>
      >(),
  },
  (t) => [
    index("deal_notes_deal_id_idx").on(t.dealId),
    index("deal_notes_crm_user_id_idx").on(t.crmUserId),
    index("deal_notes_org_idx").on(t.organizationId),
  ],
);
