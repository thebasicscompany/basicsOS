import { pgTable, text, varchar, boolean, smallint, timestamp, bigint, uuid, unique, index, } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { crmUsers } from "../../db/schema/crm_users.js";
import { organizations } from "../../db/schema/organizations.js";
export const views = pgTable("views", {
    id: text("id")
        .primaryKey()
        .default(sql `gen_random_uuid()::text`),
    objectSlug: varchar("object_slug", { length: 64 }).notNull(),
    crmUserId: bigint("crm_user_id", { mode: "number" })
        .notNull()
        .references(() => crmUsers.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    type: varchar("type", { length: 32 }).notNull().default("grid"),
    displayOrder: smallint("display_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    lockType: varchar("lock_type", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (t) => [
    index("views_slug_crm_user").on(t.objectSlug, t.crmUserId),
    index("views_object_slug_org_idx").on(t.objectSlug, t.organizationId),
]);
export const viewColumns = pgTable("view_columns", {
    id: text("id")
        .primaryKey()
        .default(sql `gen_random_uuid()::text`),
    viewId: text("view_id")
        .notNull()
        .references(() => views.id, { onDelete: "cascade" }),
    fieldId: varchar("field_id", { length: 128 }).notNull(),
    title: varchar("title", { length: 255 }),
    show: boolean("show").notNull().default(true),
    displayOrder: smallint("display_order").notNull().default(0),
    width: varchar("width", { length: 32 }),
}, (t) => [unique().on(t.viewId, t.fieldId)]);
export const viewSorts = pgTable("view_sorts", {
    id: text("id")
        .primaryKey()
        .default(sql `gen_random_uuid()::text`),
    viewId: text("view_id")
        .notNull()
        .references(() => views.id, { onDelete: "cascade" }),
    fieldId: varchar("field_id", { length: 128 }).notNull(),
    direction: varchar("direction", { length: 4 }).notNull().default("asc"),
    displayOrder: smallint("display_order").notNull().default(0),
});
export const viewFilters = pgTable("view_filters", {
    id: text("id")
        .primaryKey()
        .default(sql `gen_random_uuid()::text`),
    viewId: text("view_id")
        .notNull()
        .references(() => views.id, { onDelete: "cascade" }),
    fieldId: varchar("field_id", { length: 128 }).notNull(),
    comparisonOp: varchar("comparison_op", { length: 32 }).notNull(),
    value: text("value"),
    logicalOp: varchar("logical_op", { length: 8 }).notNull().default("and"),
});
