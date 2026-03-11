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
import { companies } from "@/db/schema/companies.js";
import { crmUsers } from "@/db/schema/crm_users.js";
import { organizations } from "@/db/schema/organizations.js";

export const companyNotes = pgTable(
  "company_notes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    companyId: bigint("company_id", { mode: "number" })
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }),
    text: text("text"),
    date: timestamp("date", { withTimezone: true }).defaultNow(),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(
      () => crmUsers.id,
      {
        onDelete: "cascade",
      },
    ),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    status: varchar("status", { length: 64 }),
    attachments:
      jsonb("attachments").$type<
        Array<{ url: string; name?: string; type?: string }>
      >(),
  },
  (t) => [
    index("company_notes_company_id_idx").on(t.companyId),
    index("company_notes_crm_user_id_idx").on(t.crmUserId),
    index("company_notes_org_idx").on(t.organizationId),
  ],
);
