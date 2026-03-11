import {
  pgTable,
  bigserial,
  varchar,
  text,
  timestamp,
  bigint,
  uuid,
  jsonb,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { crmUsers } from "@/db/schema/crm_users";
import { organizations } from "@/db/schema/organizations";

export const meetings = pgTable(
  "meetings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(
      () => crmUsers.id,
      { onDelete: "cascade" },
    ),
    title: varchar("title", { length: 512 }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    duration: integer("duration"),
    status: varchar("status", { length: 32 }).notNull().default("recording"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("meetings_org_idx").on(t.organizationId),
    index("meetings_crm_user_id_idx").on(t.crmUserId),
    index("meetings_status_idx").on(t.status),
  ],
);

export const meetingTranscripts = pgTable(
  "meeting_transcripts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    meetingId: bigint("meeting_id", { mode: "number" })
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    speaker: varchar("speaker", { length: 128 }),
    text: text("text"),
    timestampMs: integer("timestamp_ms"),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [
    index("meeting_transcripts_meeting_id_idx").on(t.meetingId),
    index("meeting_transcripts_org_idx").on(t.organizationId),
  ],
);

export const meetingSummaries = pgTable(
  "meeting_summaries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    meetingId: bigint("meeting_id", { mode: "number" })
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    summaryJson: jsonb("summary_json").$type<{
      decisions?: string[];
      actionItems?: string[];
      followUps?: string[];
      note?: string;
    }>(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique("meeting_summaries_meeting_id_unique").on(t.meetingId),
    index("meeting_summaries_org_idx").on(t.organizationId),
  ],
);
