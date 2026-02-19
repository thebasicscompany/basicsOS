import type { Context, Next } from "hono";
import { auth } from "@basicsos/auth";
import type { UserRole } from "@basicsos/auth";
import { parseRole } from "../lib/parse-role.js";

export type AuthContext = {
  userId: string;
  tenantId: string;
  role: UserRole;
  sessionId: string;
};

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

/**
 * Hono middleware that validates the session token and injects auth context.
 * MUST return the Response from c.json() — Hono only sends the response
 * when the middleware returns a Response object.
 */
export const authMiddleware = async (c: Context, next: Next): Promise<Response | void> => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const raw = session.user as Record<string, unknown>;
  const tenantId = typeof raw["tenantId"] === "string" ? raw["tenantId"] : null;

  if (!tenantId) {
    return c.json({ error: "No tenant associated with this account" }, 403);
  }

  c.set("auth", {
    userId: session.user.id,
    tenantId,
    role: parseRole(raw["role"]),
    sessionId: session.session.id,
  });

  await next();
};
