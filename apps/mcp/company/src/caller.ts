import { appRouter } from "@basicsos/api";
import type { TRPCContext } from "@basicsos/api";
import { db } from "@basicsos/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SystemCaller = ReturnType<typeof appRouter.createCaller>;

export const createSystemCaller = (tenantId: string): SystemCaller => {
  const ctx: TRPCContext = {
    db,
    userId: "system",
    tenantId,
    role: "admin",
    sessionId: null,
    headers: new Headers(),
  };
  return appRouter.createCaller(ctx);
};
