import {
  pgTable,
  bigserial,
  varchar,
  text,
  boolean,
  bigint,
  uuid,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { crmUsers } from "@/db/schema/crm_users.js";
import { organizations } from "@/db/schema/organizations.js";

export const rbacRoles = pgTable(
  "rbac_roles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    key: varchar("key", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(true),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [index("rbac_roles_org_idx").on(t.organizationId)],
);

export const rbacPermissions = pgTable("rbac_permissions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  description: text("description"),
});

export const rbacRolePermissions = pgTable(
  "rbac_role_permissions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    roleId: bigint("role_id", { mode: "number" })
      .notNull()
      .references(() => rbacRoles.id, { onDelete: "cascade" }),
    permissionId: bigint("permission_id", { mode: "number" })
      .notNull()
      .references(() => rbacPermissions.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.roleId, t.permissionId)],
);

export const rbacUserRoles = pgTable(
  "rbac_user_roles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    crmUserId: bigint("crm_user_id", { mode: "number" })
      .notNull()
      .references(() => crmUsers.id, { onDelete: "cascade" }),
    roleId: bigint("role_id", { mode: "number" })
      .notNull()
      .references(() => rbacRoles.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [
    unique().on(t.crmUserId, t.roleId, t.organizationId),
    index("rbac_user_roles_user_idx").on(t.crmUserId),
    index("rbac_user_roles_org_idx").on(t.organizationId),
  ],
);
