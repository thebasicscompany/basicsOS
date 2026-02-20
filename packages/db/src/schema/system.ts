import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { users, tenants } from "./tenants";

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    userId: uuid("user_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("events_tenant_id_idx").on(t.tenantId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    read: boolean("read").notNull().default(false),
    actionUrl: text("action_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_id_idx").on(t.userId),
    index("notifications_read_idx").on(t.read),
  ],
);

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  key: text("key").notNull().unique(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Expo push tokens registered by mobile clients.
export const pushTokens = pgTable("push_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), // Expo push token: ExponentPushToken[...]
  platform: text("platform").notNull().default("unknown"), // ios | android | unknown
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

// Per-tenant module enable/disable state. Rows only exist for overrides.
// Missing row = use the module's activeByDefault value.
export const moduleConfig = pgTable(
  "module_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    moduleName: text("module_name").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.moduleName)],
);

// LLM call telemetry — one row per API call for usage metering.
export const llmUsageLogs = pgTable(
  "llm_usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    featureName: text("feature_name"), // e.g. "assistant.chat", "meeting.summary"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("llm_usage_logs_tenant_id_idx").on(t.tenantId),
    index("llm_usage_logs_created_at_idx").on(t.createdAt),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_tenant_id_idx").on(t.tenantId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ],
);

// Stripe subscription state per tenant.
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripePriceId: text("stripe_price_id"),
  plan: text("plan").notNull().default("starter"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Managed virtual API keys for the LiteLLM proxy.
// The actual secret is only returned once at creation; only the hash is stored.
export const virtualKeys = pgTable("virtual_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(), // first 8 chars for display: "bos_live..."
  monthlyLimitTokens: integer("monthly_limit_tokens"),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
