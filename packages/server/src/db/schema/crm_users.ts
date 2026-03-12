import {
  pgTable,
  bigserial,
  varchar,
  boolean,
  uuid,
  jsonb,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations.js";
import { user } from "@/db/schema/auth.js";

export const crmUsers = pgTable("crm_users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  administrator: boolean("administrator").notNull(),
  avatar: jsonb("avatar"), // { src: string }
  disabled: boolean("disabled").notNull().default(false),
  basicsApiKey: varchar("basics_api_key", { length: 255 }),
  basicsApiKeyEnc: text("basics_api_key_enc"),
  basicsApiKeyHash: varchar("basics_api_key_hash", { length: 64 }),
  onboardingSeenAt: timestamp("onboarding_seen_at", { withTimezone: true }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", {
    withTimezone: true,
  }),
});
