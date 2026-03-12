import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";

type AuthWithApi = {
  handler: (req: Request) => Promise<Response>;
  api: {
    getSession: (opts: { headers: Headers }) => Promise<{
      user?: { id?: string };
      session?: { id?: string; token?: string };
    } | null>;
  };
};

/**
 * Supports both cookie-based auth (web) and Bearer token (pill overlay).
 * When the pill sends Authorization: Bearer <session_token>, we synthesize
 * the cookie so getSession can validate it.
 */
export function authMiddleware(auth: AuthWithApi, db: Db) {
  return async (c: Context, next: Next) => {
    let headers = c.req.raw.headers;
    const authHeader = c.req.header("Authorization");
    const cookieHeader = c.req.header("Cookie") ?? "";
    if (
      authHeader?.startsWith("Bearer ") &&
      !cookieHeader.includes("better-auth.session_token") &&
      !cookieHeader.includes("__Secure-better-auth.session_token")
    ) {
      const token = authHeader.slice(7).trim();
      if (token) {
        headers = new Headers(headers);
        headers.set(
          "Cookie",
          [
            `better-auth.session_token=${token}`,
            `__Secure-better-auth.session_token=${token}`,
          ].join("; "),
        );
      }
    }
    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const userId = session.user?.id;
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const [crmUser] = await db
      .select({ disabled: schema.crmUsers.disabled })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);

    if (!crmUser) {
      return c.json({ error: "User not found in CRM" }, 404);
    }
    if (crmUser.disabled) {
      return c.json({ error: "Account disabled" }, 403);
    }

    c.set("session", session);
    await next();
  };
}
