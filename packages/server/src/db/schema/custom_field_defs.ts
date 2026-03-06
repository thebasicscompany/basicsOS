import {
  pgTable,
  bigserial,
  varchar,
  smallint,
  jsonb,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations";

export interface CustomFieldOption {
  id: string;
  label: string;
  color?: string;
  order?: number;
  isTerminal?: boolean;
}

export const customFieldDefs = pgTable("custom_field_defs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  resource: varchar("resource", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  fieldType: varchar("field_type", { length: 32 }).notNull(),
  options: jsonb("options").$type<Array<string | CustomFieldOption>>(),
  position: smallint("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
});
