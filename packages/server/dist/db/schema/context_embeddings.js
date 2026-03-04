import { pgTable, bigserial, varchar, text, bigint, uuid, timestamp, vector, uniqueIndex, index, } from "drizzle-orm/pg-core";
import { crmUsers } from "./crm_users";
import { organizations } from "./organizations";
export const contextEmbeddings = pgTable("context_embeddings", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    crmUserId: bigint("crm_user_id", { mode: "number" })
        .notNull()
        .references(() => crmUsers.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: bigint("entity_id", { mode: "number" }).notNull(),
    chunkText: text("chunk_text").notNull(),
    embedding: vector("embedding", { dimensions: 3072 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    uniqueIndex("context_embeddings_crm_user_entity_idx").on(t.crmUserId, t.entityType, t.entityId),
    index("context_embeddings_org_idx").on(t.organizationId),
]);
