import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema/index.js";

export const PERMISSIONS = {
  recordsRead: "records.read",
  recordsWrite: "records.write",
  recordsArchive: "records.archive",
  recordsRestore: "records.restore",
  recordsDeleteHard: "records.delete.hard",
  recordsMerge: "records.merge",
  objectConfigWrite: "object_config.write",
  rbacManage: "rbac.manage",
} as const;

export function hasPermission(permissions: Set<string>, permission: string): boolean {
  return permissions.has("*") || permissions.has(permission);
}

export function wouldRemoveLastManager(params: {
  targetHadManagePermission: boolean;
  newRoleHasManagePermission: boolean;
  currentManagerCount: number;
}): boolean {
  const { targetHadManagePermission, newRoleHasManagePermission, currentManagerCount } = params;
  return targetHadManagePermission && !newRoleHasManagePermission && currentManagerCount <= 1;
}

export async function getPermissionSetForUser(
  db: Db,
  crmUser: typeof schema.crmUsers.$inferSelect
): Promise<Set<string>> {
  if (!crmUser.organizationId) return new Set();

  const roleRows = await db
    .select({ roleId: schema.rbacUserRoles.roleId })
    .from(schema.rbacUserRoles)
    .where(
      and(
        eq(schema.rbacUserRoles.crmUserId, crmUser.id),
        eq(schema.rbacUserRoles.organizationId, crmUser.organizationId)
      )
    );

  const roleIds = roleRows.map((r) => r.roleId);
  if (roleIds.length === 0) return new Set();

  const permissionRows = await db
    .select({ key: schema.rbacPermissions.key })
    .from(schema.rbacRolePermissions)
    .innerJoin(
      schema.rbacPermissions,
      eq(schema.rbacRolePermissions.permissionId, schema.rbacPermissions.id)
    )
    .where(inArray(schema.rbacRolePermissions.roleId, roleIds));

  return new Set(permissionRows.map((p) => p.key));
}

export async function getCrmUserFromSession(
  c: Context,
  db: Db
): Promise<(typeof schema.crmUsers.$inferSelect) | null> {
  const session = c.get("session") as { user?: { id?: string } } | undefined;
  const userId = session?.user?.id;
  if (!userId) return null;

  const [crmUser] = await db
    .select()
    .from(schema.crmUsers)
    .where(eq(schema.crmUsers.userId, userId))
    .limit(1);
  return crmUser ?? null;
}

export async function requirePermission(
  c: Context,
  db: Db,
  permission: string
): Promise<
  | { ok: true; crmUser: typeof schema.crmUsers.$inferSelect; permissions: Set<string> }
  | { ok: false; response: Response }
> {
  const crmUser = await getCrmUserFromSession(c, db);
  if (!crmUser) {
    return { ok: false, response: c.json({ error: "User not found in CRM" }, 404) };
  }
  const permissions = await getPermissionSetForUser(db, crmUser);
  if (!hasPermission(permissions, permission)) {
    return { ok: false, response: c.json({ error: "Forbidden" }, 403) };
  }
  return { ok: true, crmUser, permissions };
}
