import { pgTable, bigserial, bigint, varchar, boolean, smallint, jsonb, timestamp, uuid, unique, } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { crmUsers } from "./crm_users.js";
import { organizations } from "./organizations.js";
export const objectConfig = pgTable("object_config", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    singularName: varchar("singular_name", { length: 128 }).notNull(),
    pluralName: varchar("plural_name", { length: 128 }).notNull(),
    icon: varchar("icon", { length: 64 }).notNull().default("building"),
    iconColor: varchar("icon_color", { length: 32 }).notNull().default("blue"),
    tableName: varchar("table_name", { length: 128 }).notNull(),
    type: varchar("type", { length: 32 }).notNull().default("standard"),
    isActive: boolean("is_active").notNull().default(true),
    position: smallint("position").notNull().default(0),
    settings: jsonb("settings").notNull().default({}),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
});
export const objectAttributeOverrides = pgTable("object_attribute_overrides", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    objectConfigId: bigint("object_config_id", { mode: "number" })
        .notNull()
        .references(() => objectConfig.id, { onDelete: "cascade" }),
    columnName: varchar("column_name", { length: 128 }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    uiType: varchar("ui_type", { length: 64 }),
    icon: varchar("icon", { length: 64 }),
    isPrimary: boolean("is_primary").default(false),
    isHiddenByDefault: boolean("is_hidden_by_default").default(false),
    config: jsonb("config").notNull().default({}),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
}, (t) => [unique().on(t.objectConfigId, t.columnName)]);
export const recordFavorites = pgTable("record_favorites", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    crmUserId: bigint("crm_user_id", { mode: "number" })
        .notNull()
        .references(() => crmUsers.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    objectSlug: varchar("object_slug", { length: 64 }).notNull(),
    recordId: bigint("record_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => [unique().on(t.crmUserId, t.objectSlug, t.recordId)]);
export const objectConfigRelations = relations(objectConfig, ({ many }) => ({
    attributes: many(objectAttributeOverrides),
}));
export const objectAttributeOverridesRelations = relations(objectAttributeOverrides, ({ one }) => ({
    objectConfig: one(objectConfig, {
        fields: [objectAttributeOverrides.objectConfigId],
        references: [objectConfig.id],
    }),
}));
export const recordFavoritesRelations = relations(recordFavorites, ({ one }) => ({
    crmUser: one(crmUsers, {
        fields: [recordFavorites.crmUserId],
        references: [crmUsers.id],
    }),
}));
