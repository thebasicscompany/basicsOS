import { z } from "zod";
import type { Resource } from "@/routes/crm/constants.js";

const nullableString = z.string().trim().nullable();
const nullableNumber = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "string") {
    const n = Number(val);
    return isNaN(n) ? val : n;
  }
  return val;
}, z.number().nullable());

/** Accepts a string, string[], or null. Arrays are joined with commas for varchar storage. */
const multiSelectValue = z.preprocess((val) => {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.length === 0 ? null : val.join(",");
  return val;
}, z.string().nullable());

const timestampValue = z.preprocess((value) => {
  if (value === null || value === undefined || value instanceof Date)
    return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return value;
}, z.date());

const attachmentSchema = z
  .object({
    url: z.string().min(1),
    name: z.string().optional(),
    type: z.string().optional(),
  })
  .strict();

const contactsWriteSchema = z
  .object({
    firstName: nullableString.optional(),
    lastName: nullableString.optional(),
    email: nullableString.optional(),
    companyId: z.number().int().positive().nullable().optional(),
    linkedinUrl: nullableString.optional(),
    customFields: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const companiesWriteSchema = z
  .object({
    name: z.string().trim().min(1),
    domain: nullableString.optional(),
    description: nullableString.optional(),
    category: multiSelectValue.optional(),
    customFields: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const dealsWriteSchema = z
  .object({
    name: z.string().trim().min(1),
    companyId: z.number().int().positive().nullable().optional(),
    status: z.string().trim().min(1),
    amount: nullableNumber.optional(),
    customFields: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const contactNotesWriteSchema = z
  .object({
    contactId: z.number().int().positive(),
    title: nullableString.optional(),
    text: nullableString.optional(),
    date: timestampValue.nullable().optional(),
    status: nullableString.optional(),
    attachments: z.array(attachmentSchema).nullable().optional(),
  })
  .strict();

const dealNotesWriteSchema = z
  .object({
    dealId: z.number().int().positive(),
    title: nullableString.optional(),
    type: nullableString.optional(),
    text: nullableString.optional(),
    date: timestampValue.nullable().optional(),
    attachments: z.array(attachmentSchema).nullable().optional(),
  })
  .strict();

const companyNotesWriteSchema = z
  .object({
    companyId: z.number().int().positive(),
    title: nullableString.optional(),
    text: nullableString.optional(),
    date: timestampValue.nullable().optional(),
    status: nullableString.optional(),
    attachments: z.array(attachmentSchema).nullable().optional(),
  })
  .strict();

const tasksWriteSchema = z
  .object({
    contactId: z.number().int().positive().nullable().optional(),
    companyId: z.number().int().positive().nullable().optional(),
    assigneeId: z.number().int().positive().nullable().optional(),
    type: nullableString.optional(),
    text: nullableString.optional(),
    description: nullableString.optional(),
    dueDate: timestampValue.nullable().optional(),
    doneDate: timestampValue.nullable().optional(),
  })
  .strict();

const tagsWriteSchema = z
  .object({
    name: z.string().trim().min(1),
    color: z.string().trim().min(1),
  })
  .strict();

const configurationWriteSchema = z
  .object({
    config: z.record(z.string(), z.unknown()),
  })
  .strict();

const automationRulesWriteSchema = z
  .object({
    name: z.string().trim().min(1),
    enabled: z.boolean().optional(),
    workflowDefinition: z.record(z.string(), z.unknown()).optional(),
    lastRunAt: timestampValue.nullable().optional(),
  })
  .strict();

const createSchemaByResource: Partial<
  Record<Resource, z.ZodType<Record<string, unknown>>>
> = {
  contacts: contactsWriteSchema,
  companies: companiesWriteSchema,
  deals: dealsWriteSchema,
  contact_notes: contactNotesWriteSchema,
  deal_notes: dealNotesWriteSchema,
  company_notes: companyNotesWriteSchema,
  tasks: tasksWriteSchema,
  tags: tagsWriteSchema,
  configuration: configurationWriteSchema,
  automation_rules: automationRulesWriteSchema,
};

const updateSchemaByResource: Partial<
  Record<Resource, z.ZodType<Record<string, unknown>>>
> = {
  contacts: contactsWriteSchema.partial().strict(),
  companies: companiesWriteSchema.partial().strict(),
  deals: dealsWriteSchema.partial().strict(),
  contact_notes: contactNotesWriteSchema.partial().strict(),
  deal_notes: dealNotesWriteSchema.partial().strict(),
  company_notes: companyNotesWriteSchema.partial().strict(),
  tasks: tasksWriteSchema.partial().strict(),
  tags: tagsWriteSchema.partial().strict(),
  configuration: configurationWriteSchema.partial().strict(),
  automation_rules: automationRulesWriteSchema.partial().strict(),
};

export function validateWritePayload(
  resource: Resource,
  mode: "create" | "update",
  payload: Record<string, unknown>,
):
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string } {
  const schema = (
    mode === "create" ? createSchemaByResource : updateSchemaByResource
  )[resource];
  if (!schema) {
    return {
      success: false,
      error: `${mode === "create" ? "Create" : "Update"} not supported for this resource`,
    };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "payload";
    return {
      success: false,
      error: `Invalid ${path}: ${issue?.message ?? "validation failed"}`,
    };
  }

  if (Object.keys(parsed.data).length === 0) {
    return { success: false, error: `No writable fields to ${mode}` };
  }

  return { success: true, data: parsed.data };
}
