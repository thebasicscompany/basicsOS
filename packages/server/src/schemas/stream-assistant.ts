import { z } from "zod";

export const streamAssistantPostSchema = z.object({
  message: z.string().trim().min(1),
  threadId: z.string().trim().optional(),
  history: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
});
