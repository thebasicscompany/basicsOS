import { pgTable, uuid, text, timestamp, jsonb, numeric, integer, index } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { users, tenants } from "./tenants";

export const crmAttachments = pgTable(
  "crm_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entity: text("entity").notNull(),
    recordId: uuid("record_id").notNull(),
    filename: text("filename").notNull(),
    storageKey: text("storage_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    mimeType: text("mime_type").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("crm_attachments_record_idx").on(t.tenantId, t.entity, t.recordId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    companyId: uuid("company_id"), // FK to companies.id enforced at DB level (forward ref)
    customFields: jsonb("custom_fields").notNull().default({}),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("contacts_tenant_id_idx").on(t.tenantId),
    index("contacts_name_idx").on(t.name),
    index("contacts_email_idx").on(t.email),
  ],
);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    industry: text("industry"),
    customFields: jsonb("custom_fields").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("companies_tenant_id_idx").on(t.tenantId)],
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id),
    contactId: uuid("contact_id").references(() => contacts.id),
    title: text("title").notNull(),
    stage: text("stage").notNull().default("lead"),
    value: numeric("value", { precision: 12, scale: 2 }).notNull().default("0"),
    probability: integer("probability").notNull().default(50),
    closeDate: timestamp("close_date"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("deals_tenant_id_idx").on(t.tenantId),
    index("deals_stage_idx").on(t.stage),
    index("deals_company_id_idx").on(t.companyId),
  ],
);

export const dealActivities = pgTable(
  "deal_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // note | email | call | meeting
    content: text("content").notNull(),
    meetingId: uuid("meeting_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("deal_activities_deal_id_idx").on(t.dealId)],
);

export const dealActivityEmbeddings = pgTable("deal_activity_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id")
    .notNull()
    .references(() => dealActivities.id, { onDelete: "cascade" }),
  chunkText: text("chunk_text").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
