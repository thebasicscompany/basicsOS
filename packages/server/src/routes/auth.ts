import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import * as schema from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export function createAuthRoutes(
  db: Db,
  auth: ReturnType<typeof import("../auth.js").createAuth>,
  env: Env
) {
  const app = new Hono();

  app.get("/init", async (c) => {
    const orgs = await db.select().from(schema.organizations).limit(1);
    return c.json({ initialized: orgs.length > 0 });
  });

  app.get("/gateway-token", authMiddleware(auth), async (c) => {
    const session = c.get("session") as {
      user?: { id: string };
      session?: { token?: string; id?: string };
    };
    const token = session?.session?.token ?? session?.session?.id;
    if (!token) {
      return c.json({ error: "No session token" }, 401);
    }
    return c.json({ token });
  });

  app.get("/me", authMiddleware(auth), async (c) => {
    const session = c.get("session");
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const crmUserRows = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, session.user.id))
      .limit(1);

    const crmUser = crmUserRows[0];
    if (!crmUser) {
      return c.json({ error: "User not found in CRM" }, 404);
    }

    return c.json({
      id: crmUser.id,
      fullName: `${crmUser.firstName} ${crmUser.lastName}`,
      firstName: crmUser.firstName,
      lastName: crmUser.lastName,
      email: crmUser.email,
      avatar: crmUser.avatar,
      administrator: crmUser.administrator,
    });
  });

  app.patch("/me", authMiddleware(auth), async (c) => {
    const session = c.get("session") as { user?: { id: string } };
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json<{ firstName?: string; lastName?: string }>();
    const updates: Partial<{ firstName: string; lastName: string }> = {};
    if (typeof body.firstName === "string" && body.firstName.trim())
      updates.firstName = body.firstName.trim();
    if (typeof body.lastName === "string" && body.lastName.trim())
      updates.lastName = body.lastName.trim();

    if (Object.keys(updates).length === 0)
      return c.json({ error: "No valid fields to update" }, 400);

    await db
      .update(schema.crmUsers)
      .set(updates)
      .where(eq(schema.crmUsers.userId, userId));

    return c.json({ ok: true });
  });

  app.patch("/settings", authMiddleware(auth), async (c) => {
    const session = c.get("session") as { user?: { id: string } };
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json<{ basicsApiKey?: string | null }>();

    await db
      .update(schema.crmUsers)
      .set({ basicsApiKey: body.basicsApiKey ?? null })
      .where(eq(schema.crmUsers.userId, userId));

    return c.json({ ok: true });
  });

  app.get("/organization", authMiddleware(auth), async (c) => {
    const session = c.get("session") as { user?: { id: string } };
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const [crmUser] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);
    if (!crmUser) return c.json({ error: "User not found in CRM" }, 404);
    if (!crmUser.organizationId) return c.json({ error: "No organization found" }, 404);

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

  app.patch("/organization", authMiddleware(auth), async (c) => {
    const session = c.get("session") as { user?: { id: string } };
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const [crmUser] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);
    if (!crmUser) return c.json({ error: "User not found in CRM" }, 404);
    if (!crmUser.administrator) return c.json({ error: "Admin access required" }, 403);
    if (!crmUser.organizationId) return c.json({ error: "No organization found" }, 404);

    const body = await c.req
      .json<{
        name?: string;
        logo?: { src?: string } | null;
      }>()
      .catch(() => ({}));

    const updates: Partial<{
      name: string;
      logo: { src: string } | null;
      updatedAt: Date;
    }> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return c.json({ error: "Organization name cannot be empty" }, 400);
      updates.name = name.slice(0, 255);
    }

    if (body.logo === null) {
      updates.logo = null;
    } else if (body.logo && typeof body.logo.src === "string") {
      const src = body.logo.src.trim();
      updates.logo = src ? { src } : null;
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

    return c.json({
      id: org.id,
      name: org.name,
      logo: org.logo,
    });
  });

  app.post("/signup", async (c) => {
    const body = await c.req.json<{
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      invite_token?: string;
    }>();

    const { email, password, first_name, last_name, invite_token } = body;
    if (!email || !password || !first_name || !last_name) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const orgs = await db.select().from(schema.organizations).limit(1);
    const isFirstUser = orgs.length === 0;
    let organizationId: string | null = null;

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
      const inviteToken = invite_token?.trim();
      if (!inviteToken) {
        return c.json(
          { error: "Organization already exists. You need an invite token to sign up." },
          400
        );
      }

      const inviteRows = await db
        .select()
        .from(schema.invites)
        .where(eq(schema.invites.token, inviteToken))
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
        return c.json({ error: "This invite is restricted to a different email" }, 400);
      }

      organizationId = invite.organizationId;
    }

    const signUpRes = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: `${first_name} ${last_name}`,
      },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });

    if (!signUpRes || signUpRes.error) {
      return c.json(
        { error: signUpRes?.error?.message ?? "Signup failed" },
        400
      );
    }

    const { headers: resHeaders } = signUpRes as { headers?: Headers };
    if (resHeaders?.get("set-cookie")) {
      c.header("Set-Cookie", resHeaders.get("set-cookie")!);
    }

    const user = signUpRes.data?.user;
    if (!user) {
      return c.json({ error: "Signup failed" }, 400);
    }

    await db.insert(schema.crmUsers).values({
      firstName: first_name,
      lastName: last_name,
      email,
      userId: user.id,
      organizationId,
      administrator: isFirstUser,
    });

    if (!isFirstUser && invite_token?.trim()) {
      await db.delete(schema.invites).where(eq(schema.invites.token, invite_token.trim()));
    }

    return c.json({
      id: user.id,
      email,
    });
  });

  app.post("/invites", authMiddleware(auth), async (c) => {
    const session = c.get("session") as { user?: { id: string } };
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const [crmUser] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);
    if (!crmUser) return c.json({ error: "User not found in CRM" }, 404);
    if (!crmUser.administrator) return c.json({ error: "Admin access required" }, 403);
    if (!crmUser.organizationId) return c.json({ error: "No organization found" }, 400);

    const body = await c.req
      .json<{
        email?: string | null;
        expiresInHours?: number;
      }>()
      .catch(() => ({}));

    const expiresInHoursRaw = body.expiresInHours;
    const expiresInHours = Number.isFinite(expiresInHoursRaw)
      ? Math.min(Math.max(Math.floor(expiresInHoursRaw as number), 1), 24 * 30)
      : 24 * 7;

    const email = body.email?.trim() ? body.email.trim().toLowerCase() : null;
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const [invite] = await db
      .insert(schema.invites)
      .values({
        token,
        organizationId: crmUser.organizationId,
        email,
        expiresAt,
      })
      .returning();

    if (!invite) return c.json({ error: "Failed to create invite" }, 500);
    return c.json({
      token: invite.token,
      email: invite.email,
      expiresAt: invite.expiresAt,
    });
  });

  return app;
}
