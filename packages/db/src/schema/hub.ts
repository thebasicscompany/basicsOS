import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const hubLinks = pgTable("hub_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  icon: text("icon"),
  category: text("category").notNull().default("custom"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  service: text("service").notNull(), // slack | google-drive | etc
  oauthTokenEnc: text("oauth_token_enc"),
  scopes: text("scopes"),
  connectedAt: timestamp("connected_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
