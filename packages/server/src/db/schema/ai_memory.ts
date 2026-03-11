import {
  pgTable,
  bigserial,
  bigint,
  uuid,
  varchar,
  text,
  jsonb,
  smallint,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations.js";
import { crmUsers } from "@/db/schema/crm_users.js";

export const aiThreads = pgTable(
  "ai_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crmUserId: bigint("crm_user_id", { mode: "number" })
      .notNull()
      .references(() => crmUsers.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 16 }).notNull().default("chat"), // chat | voice | automation
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ai_threads_crm_user_id_idx").on(t.crmUserId),
    index("ai_threads_org_idx").on(t.organizationId),
    index("ai_threads_channel_idx").on(t.channel),
  ],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => aiThreads.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(), // system | user | assistant | tool
    content: text("content"),
    toolName: varchar("tool_name", { length: 128 }),
    toolArgs: jsonb("tool_args"),
    toolResult: jsonb("tool_result"),
    tokenCount: bigint("token_count", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("ai_messages_thread_created_idx").on(t.threadId, t.createdAt)],
);

export const aiMemoryItems = pgTable(
  "ai_memory_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    crmUserId: bigint("crm_user_id", { mode: "number" }).references(
      () => crmUsers.id,
      {
        onDelete: "set null",
      },
    ),
    scope: varchar("scope", { length: 16 }).notNull().default("org"), // org | user | thread
    threadId: uuid("thread_id").references(() => aiThreads.id, {
      onDelete: "cascade",
    }),
    kind: varchar("kind", { length: 32 }).notNull(), // preference | fact | summary | entity_state
    key: varchar("key", { length: 255 }),
    value: jsonb("value").notNull(),
    importance: smallint("importance").notNull().default(5),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("ai_memory_org_scope_kind_key_idx").on(
      t.organizationId,
      t.scope,
      t.kind,
      t.key,
    ),
    index("ai_memory_crm_user_id_idx").on(t.crmUserId),
    index("ai_memory_thread_idx").on(t.threadId),
  ],
);
