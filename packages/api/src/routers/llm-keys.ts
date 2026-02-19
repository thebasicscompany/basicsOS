import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, protectedProcedure } from "../trpc.js";
import { virtualKeys } from "@basicsos/db";

// Virtual keys follow the format: bos_live_sk_<32 random hex chars>
// Only the first 12 characters are stored in plain text (for display).
// The rest is SHA-256 hashed before storage — the plain key is returned ONCE.

const KEY_PREFIX_DISPLAY_LEN = 12; // "bos_live_sk_" (12 chars shown in UI)

const generateKey = (): { key: string; keyHash: string; keyPrefix: string } => {
  const secret = randomBytes(32).toString("hex");
  const key = `bos_live_sk_${secret}`;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const keyPrefix = key.slice(0, KEY_PREFIX_DISPLAY_LEN);
  return { key, keyHash, keyPrefix };
};

export const llmKeysRouter = router({
  /** List all virtual keys for this tenant (without the secret). */
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: virtualKeys.id,
        name: virtualKeys.name,
        keyPrefix: virtualKeys.keyPrefix,
        monthlyLimitTokens: virtualKeys.monthlyLimitTokens,
        isActive: virtualKeys.isActive,
        lastUsedAt: virtualKeys.lastUsedAt,
        createdAt: virtualKeys.createdAt,
      })
      .from(virtualKeys)
      .where(eq(virtualKeys.tenantId, ctx.tenantId));
  }),

  /**
   * Create a new virtual key. Returns the full secret ONCE — store it securely.
   * Subsequent reads only return the prefix for display.
   */
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      monthlyLimitTokens: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { key, keyHash, keyPrefix } = generateKey();

      const [row] = await ctx.db
        .insert(virtualKeys)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          keyHash,
          keyPrefix,
          monthlyLimitTokens: input.monthlyLimitTokens ?? null,
          createdBy: ctx.userId,
        })
        .returning();

      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Return the full key — this is the only time it will be visible.
      return { ...row, key };
    }),

  /** Activate or deactivate a key. */
  setActive: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(virtualKeys)
        .set({ isActive: input.isActive })
        .where(and(
          eq(virtualKeys.id, input.id),
          eq(virtualKeys.tenantId, ctx.tenantId),
        ))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /** Delete a key permanently. */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(virtualKeys)
        .where(and(
          eq(virtualKeys.id, input.id),
          eq(virtualKeys.tenantId, ctx.tenantId),
        ))
        .returning();

      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),
});

/**
 * Validate a virtual key presented in an Authorization header.
 * Returns the tenantId if valid, null if not found or inactive.
 *
 * Called by the LiteLLM proxy middleware or a dedicated /api/llm-proxy route.
 */
export const validateVirtualKey = async (rawKey: string): Promise<string | null> => {
  const { db } = await import("@basicsos/db");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const [row] = await db
    .select({ tenantId: virtualKeys.tenantId, isActive: virtualKeys.isActive, id: virtualKeys.id })
    .from(virtualKeys)
    .where(eq(virtualKeys.keyHash, keyHash));

  if (!row || !row.isActive) return null;

  // Update lastUsedAt fire-and-forget
  db
    .update(virtualKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(virtualKeys.id, row.id))
    .catch(() => undefined);

  return row.tenantId;
};
