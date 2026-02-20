import { z } from "zod";

export const triggerConfigSchema = z.object({
  eventType: z.string(),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(["eq", "neq", "gt", "lt", "contains"]),
        value: z.union([z.string(), z.number(), z.boolean()]),
      }),
    )
    .default([]),
});

export const actionSchema = z.object({
  type: z.enum([
    "send_email",
    "update_crm",
    "create_task",
    "call_webhook",
    "run_ai_prompt",
    "post_slack",
  ]),
  config: z.record(z.unknown()),
});

export const insertAutomationSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  triggerConfig: triggerConfigSchema,
  actionChain: z.array(actionSchema),
  enabled: z.boolean().default(true),
});

export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type TriggerConfig = z.infer<typeof triggerConfigSchema>;
export type AutomationAction = z.infer<typeof actionSchema>;
