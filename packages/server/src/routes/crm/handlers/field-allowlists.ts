import type { Resource } from "@/routes/crm/constants.js";

const WRITE_ALLOWLISTS: Record<Resource, readonly string[]> = {
  contacts: [
    "firstName",
    "lastName",
    "email",
    "companyId",
    "linkedinUrl",
    "customFields",
  ],
  companies: ["name", "domain", "description", "category", "customFields"],
  deals: ["name", "companyId", "status", "amount", "customFields"],
  contact_notes: [
    "contactId",
    "title",
    "text",
    "date",
    "status",
    "attachments",
  ],
  deal_notes: ["dealId", "title", "type", "text", "date", "attachments"],
  company_notes: [
    "companyId",
    "title",
    "text",
    "date",
    "status",
    "attachments",
  ],
  tasks: [
    "parentTaskId",
    "contactId",
    "companyId",
    "dealId",
    "assigneeId",
    "type",
    "text",
    "description",
    "dueDate",
    "doneDate",
  ],
  crm_users: [],
  tags: ["name", "color"],
  configuration: ["config"],
  automation_rules: ["name", "enabled", "workflowDefinition", "lastRunAt"],
  companies_summary: [],
  contacts_summary: [],
};

export function getWriteAllowlist(resource: Resource): Set<string> {
  return new Set(WRITE_ALLOWLISTS[resource] ?? []);
}
