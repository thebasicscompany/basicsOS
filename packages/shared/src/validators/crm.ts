import { z } from "zod";

export const insertContactSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  companyId: z.string().uuid().optional(),
  customFields: z.record(z.unknown()).default({}),
  createdBy: z.string().uuid(),
});

export const insertCompanySchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  domain: z.string().optional(),
  industry: z.string().optional(),
  customFields: z.record(z.unknown()).default({}),
});

export const insertDealSchema = z.object({
  tenantId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  title: z.string().min(1).max(512),
  stage: z.string().default("lead"),
  value: z.string().default("0"),
  probability: z.number().int().min(0).max(100).default(50),
  closeDate: z.date().optional(),
  createdBy: z.string().uuid(),
});

export const insertDealActivitySchema = z.object({
  dealId: z.string().uuid(),
  type: z.enum(["note", "email", "call", "meeting"]),
  content: z.string().min(1),
  meetingId: z.string().uuid().optional(),
  createdBy: z.string().uuid(),
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type InsertDealActivity = z.infer<typeof insertDealActivitySchema>;
