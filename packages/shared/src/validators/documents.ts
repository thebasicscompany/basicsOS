import { z } from "zod";

export const insertDocumentSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string().min(1).max(512),
  parentId: z.string().uuid().optional(),
  contentJson: z.record(z.unknown()).optional(),
  position: z.number().int().min(0).default(0),
  createdBy: z.string().uuid(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  parentId: z.string().uuid().nullable().optional(),
  contentJson: z.record(z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type UpdateDocument = z.infer<typeof updateDocumentSchema>;
