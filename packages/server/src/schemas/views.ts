import { z } from "zod";

export const columnPostSchema = z.object({
  fk_column_id: z.string().trim().min(1),
  title: z.string().optional(),
  show: z.boolean().optional(),
  order: z.number().int().optional(),
});

export const columnPatchSchema = z.object({
  show: z.boolean().optional(),
  order: z.number().int().optional(),
  width: z.string().optional(),
  title: z.string().trim().min(1).optional(),
});

export const sortPostSchema = z.object({
  fk_column_id: z.string().trim().min(1),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export const filterPostSchema = z.object({
  fk_column_id: z.string().trim().min(1),
  comparison_op: z.string().trim().min(1),
  value: z.unknown().optional(),
  logical_op: z.enum(["and", "or"]).optional().default("and"),
});

export const viewPatchSchema = z.object({
  title: z.string().trim().min(1),
});

export const viewPostSchema = z.object({
  title: z.string().trim().min(1).optional().default("Untitled"),
  type: z.number().int().optional(),
});
