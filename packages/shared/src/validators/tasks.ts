import { z } from "zod";

export const insertTaskSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string().min(1).max(512),
  description: z.string().optional(),
  status: z.enum(["todo", "in-progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.date().optional(),
  labels: z.array(z.string()).default([]),
  sourceType: z.enum(["meeting", "automation", "ai-employee"]).optional(),
  sourceId: z.string().uuid().optional(),
  createdBy: z.string().uuid(),
});

export const updateTaskSchema = insertTaskSchema
  .partial()
  .omit({ tenantId: true, createdBy: true });

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
