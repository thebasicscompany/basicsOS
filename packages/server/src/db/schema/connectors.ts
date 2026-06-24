import {
  pgTable,
  bigserial,
  varchar,
  text,
  timestamp,
  uuid,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations.js";

// Admin-defined custom API connectors. A connector points the platform at an
// external HTTP API (base URL + how to send the key) and stores the API key
// ENCRYPTED (api-key-crypto, AES-256-GCM). Apps/agent call it through the broker's
// `http.request` tool by slug; the broker injects the key server-side, so app code
// never holds the secret and egress is constrained to the connector's base URL.
export const connectors = pgTable(
  "connectors",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    baseUrl: varchar("base_url", { length: 512 }).notNull(),
    description: text("description").default(""),
    // How the API key is sent: bearer | header | query | none
    authScheme: varchar("auth_scheme", { length: 16 }).notNull().default("bearer"),
    // Header name (authScheme="header") or query-param name (authScheme="query"); ignored otherwise
    authName: varchar("auth_name", { length: 128 }).default(""),
    // AES-256-GCM ciphertext of the API key (null when authScheme="none")
    secretCiphertext: text("secret_ciphertext"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("connectors_org_slug_uq").on(t.organizationId, t.slug),
    index("connectors_org_idx").on(t.organizationId),
  ],
);

export type ConnectorRow = typeof connectors.$inferSelect;
