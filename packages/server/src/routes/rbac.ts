import { Hono } from "hono";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { createAuth } from "../auth.js";
import * as schema from "../db/schema/index.js";
import { PERMISSIONS, requirePermission, wouldRemoveLastManager } from "../lib/rbac.js";

type BetterAuthInstance = ReturnType<typeof createAuth>;

export function createRbacRoutes(db: Db, auth: BetterAuthInstance) {
  const app = new Hono();
  app.use("*", authMiddleware(auth, db));

  app.get("/roles", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.rbacManage);
    if (!authz.ok) return authz.response;
    const { crmUser } = authz;
    if (!crmUser.organizationId) return c.json({ error: "Organization not found" }, 404);

    const roles = await db
      .select()
      .from(schema.rbacRoles)
      .where(
        or(
          isNull(schema.rbacRoles.organizationId),
          eq(schema.rbacRoles.organizationId, crmUser.organizationId)
        )
      );

    const roleIds = roles.map((r) => r.id);
    const rolePerms =
      roleIds.length === 0
        ? []
        : await db
            .select({
              roleId: schema.rbacRolePermissions.roleId,
              permissionKey: schema.rbacPermissions.key,
            })
            .from(schema.rbacRolePermissions)
            .innerJoin(
              schema.rbacPermissions,
              eq(schema.rbacRolePermissions.permissionId, schema.rbacPermissions.id)
            )
            .where(inArray(schema.rbacRolePermissions.roleId, roleIds));

    const permsByRole = new Map<number, string[]>();
    for (const rp of rolePerms) {
      const list = permsByRole.get(rp.roleId) ?? [];
      list.push(rp.permissionKey);
      permsByRole.set(rp.roleId, list);
    }

    return c.json(
      roles.map((role) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissions: permsByRole.get(role.id) ?? [],
      }))
    );
  });

  app.get("/users", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.rbacManage);
    if (!authz.ok) return authz.response;
    const { crmUser } = authz;
    if (!crmUser.organizationId) return c.json({ error: "Organization not found" }, 404);

    const users = await db
      .select({
        id: schema.crmUsers.id,
        email: schema.crmUsers.email,
        firstName: schema.crmUsers.firstName,
        lastName: schema.crmUsers.lastName,
        disabled: schema.crmUsers.disabled,
      })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.organizationId, crmUser.organizationId));

    const userIds = users.map((u) => u.id);
    const userRoles =
      userIds.length === 0
        ? []
        : await db
            .select({
              crmUserId: schema.rbacUserRoles.crmUserId,
              roleKey: schema.rbacRoles.key,
              roleName: schema.rbacRoles.name,
            })
            .from(schema.rbacUserRoles)
            .innerJoin(schema.rbacRoles, eq(schema.rbacUserRoles.roleId, schema.rbacRoles.id))
            .where(
              and(
                inArray(schema.rbacUserRoles.crmUserId, userIds),
                eq(schema.rbacUserRoles.organizationId, crmUser.organizationId)
              )
            );

    const rolesByUser = new Map<number, Array<{ key: string; name: string }>>();
    for (const ur of userRoles) {
      const list = rolesByUser.get(ur.crmUserId) ?? [];
      list.push({ key: ur.roleKey, name: ur.roleName });
      rolesByUser.set(ur.crmUserId, list);
    }

    return c.json(
      users.map((u) => ({
        ...u,
        roles: rolesByUser.get(u.id) ?? [],
      }))
    );
  });

  app.put("/users/:crmUserId/roles", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.rbacManage);
    if (!authz.ok) return authz.response;
    const { crmUser } = authz;
    if (!crmUser.organizationId) return c.json({ error: "Organization not found" }, 404);

    const targetId = Number(c.req.param("crmUserId"));
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return c.json({ error: "Invalid crmUserId" }, 400);
    }

    const rawBody = await c.req.json().catch(() => null);
    const roleKeysRaw = (rawBody as { roleKeys?: unknown } | null)?.roleKeys;
    const roleKeys = Array.isArray(roleKeysRaw)
      ? roleKeysRaw.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      : [];
    if (roleKeys.length === 0) return c.json({ error: "roleKeys is required" }, 400);

    const [targetUser] = await db
      .select({ id: schema.crmUsers.id, organizationId: schema.crmUsers.organizationId })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.id, targetId))
      .limit(1);
    if (!targetUser) return c.json({ error: "Target user not found" }, 404);
    if (targetUser.organizationId !== crmUser.organizationId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const roles = await db
      .select({ id: schema.rbacRoles.id, key: schema.rbacRoles.key })
      .from(schema.rbacRoles)
      .where(
        and(
          inArray(schema.rbacRoles.key, roleKeys),
          or(
            isNull(schema.rbacRoles.organizationId),
            eq(schema.rbacRoles.organizationId, crmUser.organizationId)
          )
        )
      );
    if (roles.length !== roleKeys.length) {
      return c.json({ error: "One or more role keys are invalid" }, 400);
    }

    const selectedRoleIds = roles.map((r) => r.id);
    const selectedRoleManage = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.rbacRolePermissions)
      .innerJoin(
        schema.rbacPermissions,
        eq(schema.rbacRolePermissions.permissionId, schema.rbacPermissions.id)
      )
      .where(
        and(
          inArray(schema.rbacRolePermissions.roleId, selectedRoleIds),
          eq(schema.rbacPermissions.key, PERMISSIONS.rbacManage)
        )
      );
    const newRoleHasManagePermission = (selectedRoleManage[0]?.count ?? 0) > 0;

    const targetManageRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.rbacUserRoles)
      .innerJoin(
        schema.rbacRolePermissions,
        eq(schema.rbacUserRoles.roleId, schema.rbacRolePermissions.roleId)
      )
      .innerJoin(
        schema.rbacPermissions,
        eq(schema.rbacRolePermissions.permissionId, schema.rbacPermissions.id)
      )
      .where(
        and(
          eq(schema.rbacUserRoles.crmUserId, targetId),
          eq(schema.rbacUserRoles.organizationId, crmUser.organizationId),
          eq(schema.rbacPermissions.key, PERMISSIONS.rbacManage)
        )
      );
    const targetHadManagePermission = (targetManageRows[0]?.count ?? 0) > 0;

    const orgManageRows = await db
      .select({ count: sql<number>`count(distinct ${schema.rbacUserRoles.crmUserId})::int` })
      .from(schema.rbacUserRoles)
      .innerJoin(
        schema.rbacRolePermissions,
        eq(schema.rbacUserRoles.roleId, schema.rbacRolePermissions.roleId)
      )
      .innerJoin(
        schema.rbacPermissions,
        eq(schema.rbacRolePermissions.permissionId, schema.rbacPermissions.id)
      )
      .where(
        and(
          eq(schema.rbacUserRoles.organizationId, crmUser.organizationId),
          eq(schema.rbacPermissions.key, PERMISSIONS.rbacManage)
        )
      );
    const currentManagerCount = orgManageRows[0]?.count ?? 0;

    if (
      wouldRemoveLastManager({
        targetHadManagePermission,
        newRoleHasManagePermission,
        currentManagerCount,
      })
    ) {
      return c.json({ error: "Cannot remove the last RBAC manager in the organization" }, 400);
    }

    await db
      .delete(schema.rbacUserRoles)
      .where(
        and(
          eq(schema.rbacUserRoles.crmUserId, targetId),
          eq(schema.rbacUserRoles.organizationId, crmUser.organizationId)
        )
      );

    await db.insert(schema.rbacUserRoles).values(
      roles.map((r) => ({
        crmUserId: targetId,
        roleId: r.id,
        organizationId: crmUser.organizationId!,
      }))
    );

    // Keep legacy administrator flag in sync while migration is ongoing.
    await db
      .update(schema.crmUsers)
      .set({ administrator: newRoleHasManagePermission })
      .where(and(eq(schema.crmUsers.id, targetId), eq(schema.crmUsers.organizationId, crmUser.organizationId)));

    return c.json({ ok: true });
  });

  return app;
}
