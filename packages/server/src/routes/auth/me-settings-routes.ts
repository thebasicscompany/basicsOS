import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import {
  getPermissionSetForUser,
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac.js";
import { mePatchSchema } from "@/schemas/auth.js";
import { authMiddleware } from "@/middleware/auth.js";

export function registerMeSettingsRoutes(
  app: Hono,
  db: Db,
  auth: ReturnType<typeof createAuth>,
  env?: Env,
): void {
  app.get("/me", authMiddleware(auth, db), async (c) => {
    const session = c.get("session");
    const userId = session?.user?.id;
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const crmUserRows = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);

    const crmUser = crmUserRows[0];
    if (!crmUser) {
      return c.json({ error: "User not found in CRM" }, 404);
    }
    const permissions = await getPermissionSetForUser(db, crmUser);

    let hasOrgAiConfig = false;
    if (crmUser.organizationId) {
      const [orgConfig] = await db
        .select({ id: schema.orgAiConfig.id })
        .from(schema.orgAiConfig)
        .where(
          eq(schema.orgAiConfig.organizationId, crmUser.organizationId),
        )
        .limit(1);
      hasOrgAiConfig =
        Boolean(orgConfig) ||
        Boolean(env?.SERVER_BASICS_API_KEY) ||
        Boolean(env?.SERVER_BYOK_PROVIDER && env?.SERVER_BYOK_API_KEY);
    }

    return c.json({
      id: crmUser.id,
      fullName: `${crmUser.firstName} ${crmUser.lastName}`,
      firstName: crmUser.firstName,
      lastName: crmUser.lastName,
      email: crmUser.email,
      avatar: crmUser.avatar,
      administrator: hasPermission(permissions, PERMISSIONS.rbacManage),
      hasApiKey: hasOrgAiConfig,
      hasOrgAiConfig,
    });
  });

  app.patch("/me", authMiddleware(auth, db), async (c) => {
    const session = c.get("session");
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = mePatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const updates: Partial<{ firstName: string; lastName: string }> = {};
    if (parsed.data.firstName) updates.firstName = parsed.data.firstName;
    if (parsed.data.lastName) updates.lastName = parsed.data.lastName;

    if (Object.keys(updates).length === 0)
      return c.json({ error: "No valid fields to update" }, 400);

    await db
      .update(schema.crmUsers)
      .set(updates)
      .where(eq(schema.crmUsers.userId, userId));

    return c.json({ ok: true });
  });

}
