import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import * as schema from "../db/schema/index.js";
import { eq } from "drizzle-orm";

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

    const salesRow = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, session.user.id))
      .limit(1);

    const sale = salesRow[0];
    if (!sale) {
      return c.json({ error: "User not found in CRM" }, 404);
    }

    return c.json({
      id: sale.id,
      fullName: `${sale.firstName} ${sale.lastName}`,
      firstName: sale.firstName,
      lastName: sale.lastName,
      email: sale.email,
      avatar: sale.avatar,
      administrator: sale.administrator,
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
      .update(schema.sales)
      .set(updates)
      .where(eq(schema.sales.userId, userId));

    return c.json({ ok: true });
  });

  app.patch("/settings", authMiddleware(auth), async (c) => {
    const session = c.get("session") as { user?: { id: string } };
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json<{ basicsApiKey?: string | null }>();

    await db
      .update(schema.sales)
      .set({ basicsApiKey: body.basicsApiKey ?? null })
      .where(eq(schema.sales.userId, userId));

    return c.json({ ok: true });
  });

  app.post("/signup", async (c) => {
    const body = await c.req.json<{
      email: string;
      password: string;
      first_name: string;
      last_name: string;
    }>();

    const { email, password, first_name, last_name } = body;
    if (!email || !password || !first_name || !last_name) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const orgs = await db.select().from(schema.organizations).limit(1);
    const isFirstUser = orgs.length === 0;

    if (!isFirstUser) {
      return c.json(
        { error: "Organization already exists. Use an invite link to join." },
        400
      );
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

    const [org] = await db
      .insert(schema.organizations)
      .values({ name: `${first_name}'s Organization` })
      .returning();

    if (!org) {
      return c.json({ error: "Failed to create organization" }, 500);
    }

    await db.insert(schema.sales).values({
      firstName: first_name,
      lastName: last_name,
      email,
      userId: user.id,
      organizationId: org.id,
      administrator: true,
    });

    return c.json({
      id: user.id,
      email,
    });
  });

  return app;
}
