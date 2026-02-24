import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { contacts, deals } from "@basicsos/db";
import type { ActionHandler } from "./index.js";

const contactUpdateSchema = z.object({
  entity: z.literal("contact"),
  contactId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  companyId: z.string().uuid().optional(),
  customFields: z.record(z.unknown()).optional(),
});

const dealUpdateSchema = z.object({
  entity: z.literal("deal"),
  dealId: z.string().uuid(),
  title: z.string().min(1).max(512).optional(),
  stage: z.string().optional(),
  value: z.string().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  companyId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
});

const configSchema = z.discriminatedUnion("entity", [contactUpdateSchema, dealUpdateSchema]);

export const updateCrmAction: ActionHandler = async (config, ctx) => {
  const parsed = configSchema.parse(config);

  if (parsed.entity === "contact") {
    const { contactId, entity: _, ...fields } = parsed;
    if (Object.keys(fields).length === 0) {
      return { status: "failed", output: null, error: "No fields to update" };
    }

    const [updated] = await ctx.db
      .update(contacts)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, ctx.tenantId)))
      .returning({ id: contacts.id, name: contacts.name });

    if (!updated) {
      return { status: "failed", output: null, error: "Contact not found" };
    }
    return { status: "success", output: { contactId: updated.id, name: updated.name } };
  }

  const { dealId, entity: _, ...fields } = parsed;
  if (Object.keys(fields).length === 0) {
    return { status: "failed", output: null, error: "No fields to update" };
  }

  const [updated] = await ctx.db
    .update(deals)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(deals.id, dealId), eq(deals.tenantId, ctx.tenantId)))
    .returning({ id: deals.id, title: deals.title });

  if (!updated) {
    return { status: "failed", output: null, error: "Deal not found" };
  }
  return { status: "success", output: { dealId: updated.id, title: updated.title } };
};
