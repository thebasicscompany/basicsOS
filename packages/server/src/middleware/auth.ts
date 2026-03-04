import type { Context, Next } from "hono";

type AuthWithApi = {
  handler: (req: Request) => Promise<Response>;
  api: { getSession: (opts: { headers: Headers }) => Promise<{ user?: unknown } | null> };
};

/**
 * Supports both cookie-based auth (web) and Bearer token (pill overlay).
 * When the pill sends Authorization: Bearer <session_token>, we synthesize
 * the cookie so getSession can validate it.
 */
export function authMiddleware(auth: AuthWithApi) {
  return async (c: Context, next: Next) => {
    let headers = c.req.raw.headers;
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ") && !c.req.header("Cookie")?.includes("better-auth.session_token")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        headers = new Headers(headers);
        headers.set("Cookie", `better-auth.session_token=${token}`);
      }
    }
    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("session", session);
    await next();
  };
}
