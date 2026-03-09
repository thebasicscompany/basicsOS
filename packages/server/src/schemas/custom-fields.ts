import { z } from "zod";

const customFieldOptionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  color: z.string().trim().min(1).optional(),
  order: z.number().int().optional(),
  isTerminal: z.boolean().optional(),
});

export const customFieldCreateSchema = z.object({
  resource: z.string().trim().min(1),
  name: z.string().trim().min(1),
  label: z.string().trim().min(1),
  fieldType: z.string().trim().min(1),
  options: z
    .array(z.union([z.string().trim().min(1), customFieldOptionSchema]))
    .optional(),
});

export const customFieldUpdateSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  label: z.string().trim().min(1).optional(),
  options: z
    .array(z.union([z.string().trim().min(1), customFieldOptionSchema]))
    .optional(),
});
