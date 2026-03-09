import { z } from "zod";

export const signupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().trim().min(1).max(255),
  last_name: z.string().trim().min(1).max(255),
  invite_token: z.string().trim().optional(),
});

export const invitesBodySchema = z.object({
  email: z.string().email().optional().nullable(),
  expiresInHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .optional()
    .default(24 * 7),
});

export const organizationPatchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  logo: z
    .object({ src: z.string().trim().optional() })
    .strict()
    .nullable()
    .optional(),
});

export const mePatchSchema = z.object({
  firstName: z.string().trim().min(1).max(255).optional(),
  lastName: z.string().trim().min(1).max(255).optional(),
});
