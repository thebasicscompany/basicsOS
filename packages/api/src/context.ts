import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { auth } from "@basicsos/auth";
import type { UserRole } from "@basicsos/auth";
import { db, type DbConnection } from "@basicsos/db";
import { parseRole } from "./lib/parse-role.js";
import { users } from "@basicsos/db";
import { eq } from "drizzle-orm";

export type TRPCContext = {
  db: DbConnection;
  userId: string | null;
  tenantId: string | null;
  role: UserRole | null;
  sessionId: string | null;
  headers: Headers;
};

const isDev = process.env["NODE_ENV"] !== "production";

// Cache the dev user so we only query once
let devUser: { userId: string; tenantId: string; role: UserRole } | null = null;

const getDevUser = async (): Promise<{ userId: string; tenantId: string; role: UserRole } | null> => {
  if (devUser) return devUser;
  const rows = await db
    .select({ userId: users.id, tenantId: users.tenantId, role: users.role })
    .from(users)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  devUser = { userId: row.userId, tenantId: row.tenantId, role: parseRole(row.role) ?? "admin" };
  return devUser;
};

export const createContext = async (opts: FetchCreateContextFnOptions): Promise<TRPCContext> => {
  const headers = opts.req.headers;

  const session = await auth.api
    .getSession({ headers })
    .catch(() => null);

  if (session?.user) {
    const raw = session.user as Record<string, unknown>;
    const tenantId = typeof raw["tenantId"] === "string" ? raw["tenantId"] : null;
    return {
      db,
      userId: session.user.id,
      tenantId,
      role: parseRole(raw["role"]),
      sessionId: session.session.id,
      headers,
    };
  }

  // Dev bypass: if auth fails, use the first user in the database
  if (isDev) {
    const fallback = await getDevUser();
    if (fallback) {
      return {
        db,
        userId: fallback.userId,
        tenantId: fallback.tenantId,
        role: fallback.role,
        sessionId: "dev-bypass",
        headers,
      };
    }
  }

  return {
    db,
    userId: null,
    tenantId: null,
    role: null,
    sessionId: null,
    headers,
  };
};
