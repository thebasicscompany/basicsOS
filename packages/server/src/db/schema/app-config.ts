import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  smallint,
  jsonb,
  timestamp,
  uuid,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { crmUsers } from "@/db/schema/crm_users.js";
import { organizations } from "@/db/schema/organizations.js";

// Custom apps are *configuration* in the company's database, mirroring how
// `object_config` describes custom objects. One row = one app in every user's
// sidebar at /apps/:slug. The shell's AppRegistryProvider reads active rows; the
// runtime host renders `declarative` specs natively and mounts `hosted` apps in a
// sandboxed iframe. Publishing an app is a DB write here — never a signed-client
// rebuild. See docs/CONTRACTS_MCP_BROKER_AND_APP_SDK.md B.6 / PLATFORM §9.4.
//
// `spec` holds a DeclarativeSpec (pages → blocks bound to broker tools) for
// type:"declarative", or a HostedSpec (entryUrl, origin, requiredScopes) for
// type:"hosted". `permissions` is the allowlist of broker tool-name globs the app
// may call through the app-facing broker path (APP-0); every tools.call is gated
// to it. `backend_module` references a registered AppModule when the app ships
// server logic (hosted tier). `organizationId` is nullable: NULL = a global
// default app available to every company (mirrors object_config).
export const appConfig = pgTable(
  "app_config",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // Slug is unique PER ORG (organizationId NULL = a global app; NULLS NOT
    // DISTINCT keeps those globally unique). Two orgs can share a slug.
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    icon: varchar("icon", { length: 64 }).notNull().default("layout-grid"),
    iconColor: varchar("icon_color", { length: 32 }).notNull().default("blue"),
    // "declarative" | "hosted"
    type: varchar("type", { length: 32 }).notNull().default("declarative"),
    // "draft" | "preview" | "scanning" | "active" | "suspended"
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    // DeclarativeSpec | HostedSpec (discriminated by `type`)
    spec: jsonb("spec").notNull().default({}),
    // string[] — broker tool-name globs / data scopes the app may call via tools.call
    permissions: jsonb("permissions").notNull().default([]),
    // { slug: string; version: string } | null — registered backend AppModule
    backendModule: jsonb("backend_module"),
    version: varchar("version", { length: 32 }).notNull().default("1.0.0"),
    position: smallint("position").notNull().default(0),
    createdByCrmUserId: bigint("created_by_crm_user_id", {
      mode: "number",
    }).references(() => crmUsers.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("app_config_org_slug_key").on(t.organizationId, t.slug).nullsNotDistinct(),
    index("app_config_org_idx").on(t.organizationId),
    index("app_config_status_idx").on(t.status),
  ],
);

export const appConfigRelations = relations(appConfig, ({ one }) => ({
  organization: one(organizations, {
    fields: [appConfig.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(crmUsers, {
    fields: [appConfig.createdByCrmUserId],
    references: [crmUsers.id],
  }),
}));

export type AppConfigRow = typeof appConfig.$inferSelect;
