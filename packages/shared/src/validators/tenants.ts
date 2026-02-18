import { z } from "zod";

export const insertTenantSchema = z.object({
  name: z.string().min(1).max(255),
  logoUrl: z.string().url().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  domain: z.string().optional(),
  plan: z.enum(["starter", "team", "enterprise"]).default("starter"),
});

export const insertUserSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
  avatarUrl: z.string().url().optional(),
});

export const insertInviteSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertInvite = z.infer<typeof insertInviteSchema>;
