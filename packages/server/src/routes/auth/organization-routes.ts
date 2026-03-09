import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { writeAuditLogSafe } from "@/lib/audit-log.js";
import { authMiddleware } from "@/middleware/auth.js";
import { organizationPatchSchema } from "@/schemas/auth.js";

export function registerOrganizationRoutes(
  app: Hono,
  db: Db,
  auth: ReturnType<typeof createAuth>,
): void {
  app.get("/organization", authMiddleware(auth, db), async (c) => {
    const session = c.get("session");
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const [crmUser] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);
    if (!crmUser) return c.json({ error: "User not found in CRM" }, 404);
    if (!crmUser.organizationId)
      return c.json({ error: "No organization found" }, 404);

    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, crmUser.organizationId))
      .limit(1);
    if (!org) return c.json({ error: "Organization not found" }, 404);

    return c.json({
      id: org.id,
      name: org.name,
      logo: org.logo,
    });
  });

  app.patch("/organization", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.rbacManage);
    if (!authz.ok) return authz.response;
    const { crmUser } = authz;
    if (!crmUser.organizationId)
      return c.json({ error: "No organization found" }, 404);

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = organizationPatchSchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const body = parsed.data;

    const updates: Partial<{
      name: string;
      logo: { src: string } | null;
      updatedAt: Date;
    }> = {};

    if (body.name !== undefined) {
      updates.name = body.name;
    }
    if (body.logo !== undefined) {
      updates.logo =
        body.logo === null || !body.logo?.src ? null : { src: body.logo.src };
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No valid fields to update" }, 400);
    }

    updates.updatedAt = new Date();

    const [org] = await db
      .update(schema.organizations)
      .set(updates)
      .where(eq(schema.organizations.id, crmUser.organizationId))
      .returning();

    if (!org) return c.json({ error: "Organization not found" }, 404);

    await writeAuditLogSafe(db, {
      crmUserId: crmUser.id,
      organizationId: crmUser.organizationId,
      action: "organization.updated",
      entityType: "organization",
      entityId: org.id,
      metadata: { updatedFields: Object.keys(updates) },
    });

    return c.json({
      id: org.id,
      name: org.name,
      logo: org.logo,
    });
  });
}
