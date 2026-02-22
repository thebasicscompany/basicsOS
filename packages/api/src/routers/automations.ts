import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure } from "../trpc.js";
import { automations, automationRuns } from "@basicsos/db";
import { insertAutomationSchema } from "@basicsos/shared";
import { chatCompletion } from "../lib/llm-client.js";

/** System prompt for converting natural language to automation JSON. */
const buildParsePrompt = (description: string): string =>
  `You are an automation builder. Convert this description into a JSON automation spec.

Available event types (triggers):
- task.created, task.completed, task.assigned
- crm.deal.stage_changed, crm.deal.won, crm.deal.lost, crm.contact.created
- meeting.ended, meeting.summary.generated
- document.created

Available action types and their config shapes:
- create_task: { title (string), description? (string), assigneeId? (uuid), priority? ("low"|"medium"|"high"|"urgent"), dueDate? (ISO 8601) }
- call_webhook: { url (string), method? ("GET"|"POST"|"PUT"|"PATCH"), headers? (object), includePayload? (boolean) }
- run_ai_prompt: { prompt (string — may use {{field.path}} placeholders from trigger payload), systemContext? (string) }

Description: "${description}"

Respond ONLY with valid JSON matching this exact shape — no markdown fences, no extra text:
{
  "name": "Short automation name (max 60 chars)",
  "triggerConfig": {
    "eventType": "<one event type from the list above>",
    "conditions": []
  },
  "actionChain": [
    { "type": "<action type>", "config": { ... } }
  ],
  "enabled": true
}`;

/** Parse LLM response → validated automation spec (no DB write). */
const parseLlmSpec = async (
  description: string,
  tenantId: string,
): Promise<z.infer<typeof insertAutomationSchema>> => {
  const response = await chatCompletion(
    { messages: [{ role: "user", content: buildParsePrompt(description) }] },
    { tenantId, featureName: "automation-parse" },
  );

  const jsonMatch = response.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not extract automation spec from AI response",
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned invalid JSON" });
  }

  const result = insertAutomationSchema
    .omit({ tenantId: true })
    .extend({ tenantId: z.string().uuid().optional() })
    .safeParse(parsed);

  if (!result.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `AI spec failed validation: ${result.error.issues.map((i) => i.message).join(", ")}`,
    });
  }

  return { ...result.data, tenantId };
};

export const automationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return ctx.db
      .select()
      .from(automations)
      .where(eq(automations.tenantId, ctx.tenantId))
      .orderBy(desc(automations.createdAt));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const [automation] = await ctx.db
        .select()
        .from(automations)
        .where(and(eq(automations.id, input.id), eq(automations.tenantId, ctx.tenantId)));
      if (!automation) throw new TRPCError({ code: "NOT_FOUND" });
      return automation;
    }),

  create: memberProcedure
    .input(insertAutomationSchema.omit({ tenantId: true }))
    .mutation(async ({ ctx, input }) => {
      const [automation] = await ctx.db
        .insert(automations)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      if (!automation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return automation;
    }),

  update: memberProcedure
    .input(insertAutomationSchema.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      const [updated] = await ctx.db
        .update(automations)
        .set(updateData)
        .where(and(eq(automations.id, id), eq(automations.tenantId, ctx.tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  setEnabled: memberProcedure
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(automations)
        .set({ enabled: input.enabled })
        .where(and(eq(automations.id, input.id), eq(automations.tenantId, ctx.tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(automations)
        .where(and(eq(automations.id, input.id), eq(automations.tenantId, ctx.tenantId)))
        .returning();
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  listRuns: protectedProcedure
    .input(z.object({ automationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const [automation] = await ctx.db
        .select({ id: automations.id })
        .from(automations)
        .where(and(eq(automations.id, input.automationId), eq(automations.tenantId, ctx.tenantId)));
      if (!automation) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.automationId, input.automationId))
        .orderBy(desc(automationRuns.startedAt))
        .limit(100);
    }),

  /**
   * Step 1 of AI-powered creation: parse a natural language description into a structured
   * automation spec. Returns the spec for preview — does NOT write to the database.
   */
  parseFromDescription: memberProcedure
    .input(z.object({ description: z.string().min(10).max(1000) }))
    .mutation(async ({ ctx, input }) => parseLlmSpec(input.description, ctx.tenantId)),

  /**
   * Step 2 of AI-powered creation: save the user-confirmed automation spec to the database.
   * Called after the user reviews the preview returned by parseFromDescription.
   */
  createFromParsed: memberProcedure
    .input(insertAutomationSchema.omit({ tenantId: true }))
    .mutation(async ({ ctx, input }) => {
      const [automation] = await ctx.db
        .insert(automations)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      if (!automation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return automation;
    }),
});
