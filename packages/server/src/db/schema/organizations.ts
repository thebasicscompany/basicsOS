import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  logo: jsonb("logo").$type<{ src: string } | null>(),
  // IANA timezone, the org's default for scheduled automations (e.g. America/New_York).
  timezone: varchar("timezone", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
