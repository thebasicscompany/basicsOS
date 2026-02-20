import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { TRPCError } from "@trpc/server";
import { ragChat } from "../lib/rag.js";

const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const assistantRouter = router({
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        history: z.array(conversationMessageSchema).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const result = await ragChat(input.message, ctx.tenantId, input.history, ctx.userId);
      return result;
    }),
});
