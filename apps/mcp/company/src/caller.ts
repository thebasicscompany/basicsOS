import { appRouter } from "@basicsos/api";
import type { TRPCContext } from "@basicsos/api";
import { db } from "@basicsos/db";
import { z } from "zod";

const uuidSchema = z.string().uuid();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SystemCaller = ReturnType<typeof appRouter.createCaller>;

export const createSystemCaller = (tenantId: string, userId?: string): SystemCaller => {
  const ctx: TRPCContext = {
    db,
    userId: userId ?? process.env["MCP_USER_ID"] ?? "system",
    tenantId,
    role: "admin",
    sessionId: null,
    headers: new Headers(),
  };
  return appRouter.createCaller(ctx);
};

type WriteContext = { tenantId: string; userId: string };
type WriteContextResult = { ok: true; ctx: WriteContext } | { ok: false; error: string };

/**
 * Validates that MCP_TENANT_ID and MCP_USER_ID are set to valid UUIDs.
 * MCP_USER_ID must be a real user UUID because write operations store it in
 * `created_by` columns which reference the users table.
 */
export const getMcpWriteContext = (): WriteContextResult => {
  const tenantId = process.env["MCP_TENANT_ID"] ?? "";
  const userId = process.env["MCP_USER_ID"] ?? "";

  if (!uuidSchema.safeParse(tenantId).success) {
    return { ok: false, error: "MCP_TENANT_ID is not configured or is not a valid UUID" };
  }
  if (!uuidSchema.safeParse(userId).success) {
    return {
      ok: false,
      error:
        "MCP_USER_ID must be set to your user UUID. Find it in Settings → MCP Connection on the web app.",
    };
  }
  return { ok: true, ctx: { tenantId, userId } };
};
