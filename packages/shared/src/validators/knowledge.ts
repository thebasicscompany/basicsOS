import { z } from "zod";

export const createKnowledgeDocumentSchema = z.object({
  title: z.string().min(1).max(512),
  parentId: z.string().uuid().optional(),
  position: z.number().int().min(0).default(0),
});

export const updateKnowledgeDocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(512).optional(),
  contentJson: z.record(z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
});

export const reorderKnowledgeDocumentsSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    }),
  ),
});

export type CreateKnowledgeDocument = z.infer<typeof createKnowledgeDocumentSchema>;
export type UpdateKnowledgeDocument = z.infer<typeof updateKnowledgeDocumentSchema>;
export type ReorderKnowledgeDocuments = z.infer<typeof reorderKnowledgeDocumentsSchema>;
