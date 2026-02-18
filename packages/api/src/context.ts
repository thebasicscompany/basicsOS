import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { auth, USER_ROLES, type UserRole } from "@basicsos/auth";
import { db, type DbConnection } from "@basicsos/db";

const parseRole = (role: unknown): UserRole => {
  const found = USER_ROLES.find((r) => r === role);
  return found ?? "member";
};

export type TRPCContext = {
  db: DbConnection;
  userId: string | null;
  tenantId: string | null;
  role: UserRole | null;
  sessionId: string | null;
  headers: Headers;
};

export const createContext = async (
  opts: FetchCreateContextFnOptions,
): Promise<TRPCContext> => {
  const session = await auth.api.getSession({
    headers: opts.req.headers,
  }).catch(() => null);

  if (!session?.user) {
    return {
      db,
      userId: null,
      tenantId: null,
      role: null,
      sessionId: null,
      headers: opts.req.headers,
    };
  }

  const raw = session.user as Record<string, unknown>;
  const tenantId = typeof raw["tenantId"] === "string" ? raw["tenantId"] : null;

  return {
    db,
    userId: session.user.id,
    tenantId,
    role: parseRole(raw["role"]),
    sessionId: session.session.id,
    headers: opts.req.headers,
  };
};
