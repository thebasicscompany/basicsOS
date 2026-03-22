import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { writeAuditLogSafe } from "@/lib/audit-log.js";
import { authMiddleware } from "@/middleware/auth.js";
import {
  signupBodySchema,
  invitesBodySchema,
} from "@/schemas/auth.js";
import { sendOrgEmail } from "@/lib/send-org-email.js";

function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export function registerInitSignupInviteRoutes(
  app: Hono,
  db: Db,
  auth: ReturnType<typeof createAuth>,
  env: Env,
): void {
  app.get("/init", async (c) => {
    const orgs = await db.select().from(schema.organizations).limit(1);
    return c.json({ initialized: orgs.length > 0 });
  });

  app.post("/signup", async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = signupBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const { email, password, first_name, last_name, invite_token } =
      parsed.data;

    const orgs = await db.select().from(schema.organizations).limit(1);
    const isFirstUser = orgs.length === 0;
    let organizationId: string | null = null;
    const inviteTokenParsed = invite_token?.trim();

    if (isFirstUser) {
      const [org] = await db
        .insert(schema.organizations)
        .values({ name: `${first_name}'s Organization` })
        .returning();

      if (!org) {
        return c.json({ error: "Failed to create organization" }, 500);
      }
      organizationId = org.id;
    } else {
      if (!inviteTokenParsed) {
        return c.json(
          {
            error:
              "Organization already exists. You need an invite token to sign up.",
          },
          400,
        );
      }

      const inviteRows = await db
        .select()
        .from(schema.invites)
        .where(eq(schema.invites.token, inviteTokenParsed))
        .limit(1);
      const invite = inviteRows[0];
      if (!invite) {
        return c.json({ error: "Invalid invite token" }, 400);
      }

      if (invite.expiresAt.getTime() < Date.now()) {
        await db.delete(schema.invites).where(eq(schema.invites.id, invite.id));
        return c.json({ error: "Invite token has expired" }, 400);
      }

      if (
        invite.email &&
        invite.email.trim().toLowerCase() !== email.trim().toLowerCase()
      ) {
        return c.json(
          { error: "This invite is restricted to a different email" },
          400,
        );
      }

      organizationId = invite.organizationId;
    }

    const signUpRes = (await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: `${first_name} ${last_name}`,
      },
      headers: c.req.raw.headers,
      returnHeaders: true,
    })) as {
      headers?: Headers;
      error?: { message?: string };
      data?: { user?: { id: string } };
      response?: { user?: { id: string } };
    };

    if (signUpRes.error) {
      return c.json({ error: signUpRes.error.message ?? "Signup failed" }, 400);
    }

    const { headers: resHeaders } = signUpRes as { headers?: Headers };
    if (resHeaders?.get("set-cookie")) {
      c.header("Set-Cookie", resHeaders.get("set-cookie")!);
    }

    const user = signUpRes.data?.user ?? signUpRes.response?.user;
    if (!user) {
      return c.json({ error: "Signup failed" }, 400);
    }

    const [createdCrmUser] = await db
      .insert(schema.crmUsers)
      .values({
        firstName: first_name,
        lastName: last_name,
        email,
        userId: user.id,
        organizationId,
        administrator: isFirstUser,
      })
      .returning({
        id: schema.crmUsers.id,
        organizationId: schema.crmUsers.organizationId,
      });

    if (createdCrmUser?.organizationId) {
      const roleKey = isFirstUser ? "org_admin" : "member";
      const [role] = await db
        .select({ id: schema.rbacRoles.id })
        .from(schema.rbacRoles)
        .where(eq(schema.rbacRoles.key, roleKey))
        .limit(1);
      if (role) {
        await db
          .insert(schema.rbacUserRoles)
          .values({
            crmUserId: createdCrmUser.id,
            roleId: role.id,
            organizationId: createdCrmUser.organizationId,
          })
          .onConflictDoNothing();
      }
    }

    if (!isFirstUser && inviteTokenParsed) {
      await db
        .delete(schema.invites)
        .where(eq(schema.invites.token, inviteTokenParsed));
    }

    return c.json({
      id: user.id,
      email,
    });
  });

  app.post("/invites", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.rbacManage);
    if (!authz.ok) return authz.response;
    const { crmUser } = authz;
    if (!crmUser.organizationId)
      return c.json({ error: "No organization found" }, 400);

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = invitesBodySchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Validation failed";
      return c.json({ error: msg }, 400);
    }
    const { email, expiresInHours, sendEmail } = parsed.data;
    const emailNormalized = email?.trim()
      ? email.trim().toLowerCase()
      : null;
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const [invite] = await db
      .insert(schema.invites)
      .values({
        token,
        organizationId: crmUser.organizationId,
        email: emailNormalized,
        expiresAt,
      })
      .returning();

    if (!invite) return c.json({ error: "Failed to create invite" }, 500);

    await writeAuditLogSafe(db, {
      crmUserId: crmUser.id,
      organizationId: crmUser.organizationId,
      action: "invite.created",
      entityType: "invite",
      entityId: invite.id,
      metadata: {
        email: invite.email,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });

    const baseUrl = (env.INVITE_LINK_BASE_URL ?? "https://basicsos.com").replace(/\/$/, "");
    const apiOrigin = new URL(env.BETTER_AUTH_URL).origin;
    const isHostedAuth = baseUrl.includes("basicsos.com");
    const signupLink = isHostedAuth
      ? `${baseUrl}/auth/signup?invite=${token}&apiUrl=${encodeURIComponent(apiOrigin)}`
      : `${baseUrl}/sign-up?invite=${token}`;

    let emailSent = false;
    let emailError: string | undefined;
    if (sendEmail && emailNormalized) {
      const result = await sendOrgEmail(db, env, crmUser.organizationId, {
        to: emailNormalized,
        subject: "You're invited to join",
        content: `You've been invited to join. Click the link to create your account:\n\n${signupLink}\n\nThe link will expire ${expiresAt.toLocaleDateString()}.`,
      });
      emailSent = result.ok;
      emailError = result.error;
    }

    return c.json({
      token: invite.token,
      signupLink,
      email: invite.email,
      expiresAt: invite.expiresAt,
      emailSent: sendEmail ? emailSent : undefined,
      emailError: sendEmail && !emailSent ? emailError : undefined,
    });
  });
}
