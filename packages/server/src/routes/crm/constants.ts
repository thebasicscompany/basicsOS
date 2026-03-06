import * as schema from "@/db/schema/index.js";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

export const CRM_RESOURCES = [
  "contacts",
  "companies",
  "deals",
  "contact_notes",
  "deal_notes",
  "company_notes",
  "tasks",
  "crm_users",
  "tags",
  "configuration",
  "automation_rules",
  "companies_summary",
  "contacts_summary",
] as const;

export type Resource = (typeof CRM_RESOURCES)[number];

export const TABLE_MAP: Record<
  Exclude<Resource, "companies_summary" | "contacts_summary">,
  PgTableWithColumns<any>
> = {
  contacts: schema.contacts,
  companies: schema.companies,
  deals: schema.deals,
  contact_notes: schema.contactNotes,
  deal_notes: schema.dealNotes,
  company_notes: schema.companyNotes,
  tasks: schema.tasks,
  crm_users: schema.crmUsers,
  tags: schema.tags,
  configuration: schema.configuration,
  automation_rules: schema.automationRules,
};

export function hasCrmUserId(resource: Resource): boolean {
  return [
    "contacts",
    "companies",
    "deals",
    "contact_notes",
    "deal_notes",
    "company_notes",
    "tasks",
    "crm_users",
    "automation_rules",
  ].includes(resource);
}

export function hasOrganizationId(resource: Resource): boolean {
  return [
    "contacts",
    "companies",
    "deals",
    "contact_notes",
    "deal_notes",
    "company_notes",
    "tasks",
    "crm_users",
    "tags",
    "automation_rules",
  ].includes(resource);
}
