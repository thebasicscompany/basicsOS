import {
  pgTable,
  bigserial,
  varchar,
  text,
  uuid,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations.js";
import { crmUsers } from "@/db/schema/crm_users.js";

export const orgAiConfig = pgTable("org_ai_config", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" })
    .unique(),
  keyType: varchar("key_type", { length: 20 }).notNull().default("basicsos"),
  byokProvider: varchar("byok_provider", { length: 20 }),
  apiKeyEnc: text("api_key_enc"),
  apiKeyHash: varchar("api_key_hash", { length: 64 }),
  /** Transcription BYOK: e.g. "deepgram". When set, gateway uses this key for STT. */
  transcriptionByokProvider: varchar("transcription_byok_provider", {
    length: 20,
  }),
  transcriptionApiKeyEnc: text("transcription_api_key_enc"),
  configuredBy: bigint("configured_by", { mode: "number" }).references(
    () => crmUsers.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
