import { z } from "zod";

export const favoritesPostSchema = z.object({
  objectSlug: z.string().trim().min(1),
  recordId: z.number().int().positive(),
});

export const objectConfigPutSchema = z.object({
  singularName: z.string().trim().min(1).max(255).optional(),
  pluralName: z.string().trim().min(1).max(255).optional(),
  icon: z.string().optional(),
  iconColor: z.string().optional(),
  tableName: z.string().optional(),
  type: z.string().optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const objectConfigCreateSchema = z.object({
  singularName: z.string().trim().min(1).max(128),
  pluralName: z.string().trim().min(1).max(128),
  icon: z.string().default("building"),
  iconColor: z.string().default("blue"),
  fields: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(128),
        label: z.string().trim().min(1).max(255),
        fieldType: z.string().trim().min(1).max(32),
        options: z.array(z.string()).optional(),
      }),
    )
    .optional()
    .default([]),
});

export const attributeOverridePostSchema = z.object({
  columnName: z.string().trim().min(1),
  displayName: z.string().trim().nullable().optional(),
  uiType: z.string().trim().nullable().optional(),
  icon: z.string().trim().nullable().optional(),
  isPrimary: z.boolean().optional(),
  isHiddenByDefault: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
