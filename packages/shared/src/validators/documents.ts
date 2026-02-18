import { z } from "zod";

export const insertDocumentSchema = z.object({
  tenantId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  title: z.string().min(1).max(512),
  contentJson: z.record(z.unknown()).optional(),
  position: z.number().int().min(0).default(0),
  createdBy: z.string().uuid(),
});

export const updateDocumentSchema = insertDocumentSchema.partial().omit({ tenantId: true, createdBy: true });

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type UpdateDocument = z.infer<typeof updateDocumentSchema>;
