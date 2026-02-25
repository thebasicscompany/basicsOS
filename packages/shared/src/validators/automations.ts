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

/** Serializable flow node (matches React Flow node shape for persistence). */
export const flowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.unknown()),
});
/** Serializable flow edge. */
export const flowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});

export const insertAutomationSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  triggerConfig: triggerConfigSchema,
  actionChain: z.array(actionSchema),
  enabled: z.boolean().default(true),
});

export const updateAutomationFlowSchema = z.object({
  flowNodes: z.array(flowNodeSchema).optional(),
  flowEdges: z.array(flowEdgeSchema).optional(),
});

export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type TriggerConfig = z.infer<typeof triggerConfigSchema>;
export type AutomationAction = z.infer<typeof actionSchema>;
