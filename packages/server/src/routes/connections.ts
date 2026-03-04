import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import * as schema from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import { PERMISSIONS, requirePermission } from "../lib/rbac.js";
import { resolveStoredApiKey } from "../lib/api-key-crypto.js";

type Auth = ReturnType<typeof import("../auth.js").createAuth>;

export function createConnectionsRoutes(db: Db, auth: Auth, env: Env) {
  const app = new Hono();

  async function getCrmUserApiKey(userId: string): Promise<string | null> {
    const rows = await db
      .select({
        basicsApiKey: schema.crmUsers.basicsApiKey,
        basicsApiKeyEnc: schema.crmUsers.basicsApiKeyEnc,
      })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);
    return rows[0] ? resolveStoredApiKey(rows[0]) : null;
  }

  // List all connections for the authenticated user
  app.get("/", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const session = c.get("session") as { user?: { id: string } };
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const apiKey = await getCrmUserApiKey(userId);
    if (!apiKey) return c.json([]);

    const res = await fetch(`${env.BASICOS_API_URL}/v1/connections`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return c.json([]);
    return c.json(await res.json());
  });

  // Initiate OAuth — fetches the provider URL and redirects the browser
  app.get("/:provider/authorize", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const session = c.get("session") as { user?: { id: string } };
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const provider = c.req.param("provider");
    const apiKey = await getCrmUserApiKey(userId);
    if (!apiKey) return c.json({ error: "Basics API key not configured" }, 400);

    const redirectAfter = encodeURIComponent(`${env.BETTER_AUTH_URL}/connections`);
    const res = await fetch(
      `${env.BASICOS_API_URL}/v1/connections/${provider}/authorize?redirect_after=${redirectAfter}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: text }, 400);
    }

    const { url } = (await res.json()) as { url: string };
    return c.redirect(url);
  });

  // Delete / disconnect a provider
  app.delete("/:provider", authMiddleware(auth, db), async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsRead);
    if (!authz.ok) return authz.response;

    const session = c.get("session") as { user?: { id: string } };
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const provider = c.req.param("provider");
    const apiKey = await getCrmUserApiKey(userId);
    if (!apiKey) return c.json({ error: "Basics API key not configured" }, 400);

    const res = await fetch(`${env.BASICOS_API_URL}/v1/connections/${provider}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) return c.json({ error: "Failed to delete connection" }, 500);
    return c.json({ ok: true });
  });

  return app;
}
