import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { eq, and, isNull } from "drizzle-orm";
import {
  type HybridSearchContext,
  resolveCompanyByName,
  resolveContactByName,
  resolveDealByName,
  searchCompaniesByQuery,
  searchContactsByQuery,
  searchDealsByQuery,
} from "@/lib/resolve-by-name.js";

export const ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_contacts",
      description:
        "Search contacts by name or email. Use when the user asks about a contact or wants to find someone.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Name or email to search for",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_contact",
      description:
        "Fetch a single contact. Use contact_name (e.g. 'John Smith') or id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "Contact ID from a prior search" },
          contact_name: { type: "string", description: "Name or email to look up" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_contact",
      description:
        "Create a new contact/person in the CRM. Use when the user wants to add a new person, contact, or lead.",
      parameters: {
        type: "object",
        properties: {
          first_name: {
            type: "string",
            description: "First name of the contact",
          },
          last_name: {
            type: "string",
            description: "Last name of the contact",
          },
          email: {
            type: "string",
            description: "Email address of the contact",
          },
          company_id: { type: "number", description: "Company ID from a prior search" },
          company_name: { type: "string", description: "Company name to link to" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_contact",
      description:
        "Update an existing contact's details. Use contact_name or id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "Contact ID from a prior search" },
          contact_name: { type: "string", description: "Name or email to look up" },
          first_name: {
            type: "string",
            description: "New first name",
          },
          last_name: {
            type: "string",
            description: "New last name",
          },
          email: {
            type: "string",
            description: "New email address",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_companies",
      description:
        "Search companies by name. Use when the user asks about a company.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Company name to search for",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_company",
      description:
        "Create a new company in the CRM. Use when the user wants to add a new company or organization.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Company name",
          },
          category: {
            type: "string",
            description: "Company category or industry",
          },
          domain: {
            type: "string",
            description: "Company website domain",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_company",
      description:
        "Update a company's details. Use company_name or id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "Company ID from a prior search" },
          company_name: { type: "string", description: "Company name to look up" },
          name: {
            type: "string",
            description: "New company name",
          },
          category: {
            type: "string",
            description: "New company category or industry",
          },
          domain: {
            type: "string",
            description: "New company website domain",
          },
          description: {
            type: "string",
            description: "New company description",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_deals",
      description:
        "Search deals by name or status. Use when the user asks about deals or pipeline.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Deal name to search for",
          },
          status: {
            type: "string",
            description: "Filter by deal status",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_deal",
      description:
        "Create a new deal in the CRM. Use when the user wants to add a new deal or opportunity.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Deal name",
          },
          status: {
            type: "string",
            description: "Deal status (e.g. opportunity, won, lost)",
          },
          company_id: { type: "number", description: "Company ID from a prior search" },
          company_name: { type: "string", description: "Company name to link to" },
          amount: {
            type: "number",
            description: "Deal amount in dollars",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_deal",
      description:
        "Update a deal's status or other fields. Use deal_name or deal_id.",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "number", description: "Deal ID from a prior search" },
          deal_name: { type: "string", description: "Deal name to look up" },
          name: {
            type: "string",
            description: "New deal name",
          },
          status: {
            type: "string",
            description: "The new status for the deal",
          },
          amount: {
            type: "number",
            description: "New deal amount",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description:
        "Create a new task for a contact. Use when the user wants to add a follow-up task, reminder, or to-do for a contact.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "number", description: "Contact ID from a prior search" },
          contact_name: { type: "string", description: "Contact name or email to look up" },
          text: {
            type: "string",
            description: "Description of the task",
          },
          type: {
            type: "string",
            description: "Task type (e.g. call, email, meeting)",
            default: "call",
          },
          due_date: {
            type: "string",
            description:
              "Due date in ISO 8601 format (e.g. 2025-02-28T12:00:00Z)",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_note",
      description:
        "Add a note to a contact or deal. Use contact_name/deal_name (e.g. 'Acme deal') or contact_id/deal_id.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "number", description: "Contact ID from a prior search" },
          contact_name: { type: "string", description: "Contact name or email to look up" },
          deal_id: { type: "number", description: "Deal ID from a prior search" },
          deal_name: { type: "string", description: "Deal name to look up" },
          text: {
            type: "string",
            description: "The note content",
          },
        },
        required: ["text"],
      },
    },
  },
];

function mdLink(name: string, objectSlug: string, id: number): string {
  return `[[${objectSlug}/${id}|${name}]]`;
}

export async function executeAssistantToolDrizzle(
  db: Db,
  crmUserId: number,
  organizationId: string,
  toolName: string,
  args: Record<string, unknown>,
  searchContext?: HybridSearchContext,
): Promise<string> {
  try {
    if (toolName === "search_contacts") {
      const query = (args.query as string)?.trim() ?? "";
      const rows = await searchContactsByQuery(
        db,
        organizationId,
        query,
        searchContext,
        10,
      );
      if (rows.length === 0) return "No contacts found.";
      return rows
        .map((c) => {
          const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed";
          const parts = [mdLink(name, "contacts", c.id)];
          if (c.email) parts.push(c.email);
          return `- ${parts.join(" | ")}`;
        })
        .join("\n");
    }

    if (toolName === "search_companies") {
      const query = (args.query as string)?.trim() ?? "";
      const rows = await searchCompaniesByQuery(
        db,
        organizationId,
        query,
        searchContext,
        10,
      );
      if (rows.length === 0) return "No companies found.";
      return rows
        .map((c) => {
          const parts = [mdLink(c.name, "companies", c.id)];
          if (c.category) parts.push(`category: ${c.category}`);
          if (c.domain) parts.push(c.domain);
          return `- ${parts.join(" | ")}`;
        })
        .join("\n");
    }

    if (toolName === "get_contact") {
      let contactId = args.id as number | undefined;
      if (contactId == null && args.contact_name) {
        contactId = (await resolveContactByName(
          db,
          organizationId,
          String(args.contact_name),
          searchContext,
        )) ?? undefined;
        if (contactId == null) return "No contact found matching that name.";
      }
      if (contactId == null) return "Error: Provide id or contact_name";
      const [row] = await db
        .select()
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.id, contactId),
            eq(schema.contacts.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!row) return "Contact not found.";
      const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || "Unnamed";
      const parts = [`Name: ${mdLink(name, "contacts", row.id)}`];
      if (row.email) parts.push(`Email: ${row.email}`);
      return parts.join("\n");
    }

    if (toolName === "create_contact") {
      const firstName = (args.first_name as string)?.trim() ?? null;
      const lastName = (args.last_name as string)?.trim() ?? null;
      const email = (args.email as string)?.trim() ?? null;
      let companyId: number | null = (args.company_id as number) ?? null;
      if (companyId == null && args.company_name) {
        companyId = await resolveCompanyByName(
          db,
          organizationId,
          String(args.company_name),
          searchContext,
        );
      }

      const [row] = await db
        .insert(schema.contacts)
        .values({
          crmUserId,
          organizationId,
          firstName,
          lastName,
          email,
          ...(companyId != null && { companyId }),
        })
        .returning();
      if (!row) return "Error: Failed to create contact";
      const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || "Contact";
      return `Created: ${mdLink(name, "contacts", row.id)}`;
    }

    if (toolName === "update_contact") {
      let contactId = args.id as number | undefined;
      if (contactId == null && args.contact_name) {
        contactId = (await resolveContactByName(
          db,
          organizationId,
          String(args.contact_name),
          searchContext,
        )) ?? undefined;
        if (contactId == null) return "No contact found matching that name.";
      }
      if (contactId == null) return "Error: Provide id or contact_name";
      const updates: Record<string, unknown> = {};
      if (args.first_name !== undefined) updates.firstName = (args.first_name as string).trim();
      if (args.last_name !== undefined) updates.lastName = (args.last_name as string).trim();
      if (args.email !== undefined) updates.email = (args.email as string).trim();

      if (Object.keys(updates).length === 0) {
        return "Error: At least one field (first_name, last_name, email) is required";
      }

      const [row] = await db
        .update(schema.contacts)
        .set(updates)
        .where(
          and(
            eq(schema.contacts.id, contactId),
            eq(schema.contacts.organizationId, organizationId),
          ),
        )
        .returning();
      if (!row) return "Error: Contact not found";
      const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || "Contact";
      return `Updated: ${mdLink(name, "contacts", row.id)}`;
    }

    if (toolName === "create_company") {
      const name = (args.name as string)?.trim();
      if (!name) return "Error: Company name is required";

      const [row] = await db
        .insert(schema.companies)
        .values({
          crmUserId,
          organizationId,
          name,
          category: (args.category as string)?.trim() ?? null,
          domain: (args.domain as string)?.trim() ?? null,
        })
        .returning();
      if (!row) return "Error: Failed to create company";
      return `Created: ${mdLink(row.name, "companies", row.id)}`;
    }

    if (toolName === "update_company") {
      let companyId = args.id as number | undefined;
      if (companyId == null && args.company_name) {
        companyId = (await resolveCompanyByName(
          db,
          organizationId,
          String(args.company_name),
          searchContext,
        )) ?? undefined;
        if (companyId == null) return "No company found matching that name.";
      }
      if (companyId == null) return "Error: Provide id or company_name";

      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) updateData.name = (args.name as string).trim();
      if (args.category !== undefined) updateData.category = (args.category as string).trim();
      if (args.domain !== undefined) updateData.domain = (args.domain as string).trim();
      if (args.description !== undefined)
        updateData.description = (args.description as string).trim();

      if (Object.keys(updateData).length === 0) {
        return "Error: At least one field (name, category, domain, description) is required";
      }

      const [updated] = await db
        .update(schema.companies)
        .set(updateData)
        .where(
          and(
            eq(schema.companies.id, companyId),
            eq(schema.companies.organizationId, organizationId),
          ),
        )
        .returning();

      if (!updated) {
        return "Error: Company not found or update failed";
      }
      return `Updated: ${mdLink(updated.name, "companies", updated.id)}`;
    }

    if (toolName === "create_deal") {
      const name = (args.name as string)?.trim();
      if (!name) return "Error: Deal name is required";
      let companyId: number | null = (args.company_id as number) ?? null;
      if (companyId == null && args.company_name) {
        companyId = await resolveCompanyByName(
          db,
          organizationId,
          String(args.company_name),
          searchContext,
        );
      }

      const [row] = await db
        .insert(schema.deals)
        .values({
          crmUserId,
          organizationId,
          name,
          status: (args.status as string) ?? "opportunity",
          ...(companyId != null && { companyId }),
          amount: (args.amount as number) ?? null,
        })
        .returning();
      if (!row) return "Error: Failed to create deal";
      return `Created: ${mdLink(row.name, "deals", row.id)}`;
    }

    if (toolName === "search_deals") {
      const query = (args.query as string)?.trim() ?? "";
      const status = (args.status as string)?.trim();
      let rows = await searchDealsByQuery(
        db,
        organizationId,
        query,
        searchContext,
        10,
      );
      if (status) rows = rows.filter((row) => row.status === status);
      if (rows.length === 0) return "No deals found.";
      return rows
        .map((d) => {
          const parts = [mdLink(d.name, "deals", d.id)];
          if (d.status) parts.push(`status: ${d.status}`);
          if (d.amount != null) parts.push(`$${Number(d.amount).toLocaleString()}`);
          return `- ${parts.join(" | ")}`;
        })
        .join("\n");
    }

    if (toolName === "create_task") {
      let contactId = args.contact_id as number | undefined;
      if (contactId == null && args.contact_name) {
        contactId = (await resolveContactByName(
          db,
          organizationId,
          String(args.contact_name),
          searchContext,
        )) ?? undefined;
        if (contactId == null) return "No contact found matching that name.";
      }
      if (contactId == null) return "Error: Provide contact_id or contact_name";
      const text = args.text as string;
      const type = (args.type as string) ?? "call";
      const dueDate =
        (args.due_date as string) ??
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [contact] = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.id, contactId),
            eq(schema.contacts.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!contact) return "Error: Contact not found";

      const [data] = await db
        .insert(schema.tasks)
        .values({
          contactId,
          crmUserId,
          organizationId,
          type,
          text,
          dueDate: new Date(dueDate),
        })
        .returning({ id: schema.tasks.id });

      if (!data) {
        return "Error: Failed to create task";
      }
      return `Task created successfully (id: ${(data as { id: number }).id})`;
    }

    if (toolName === "add_note") {
      let contactId = args.contact_id as number | undefined;
      let dealId = args.deal_id as number | undefined;
      const text = args.text as string;
      if (contactId == null && args.contact_name) {
        contactId = (await resolveContactByName(
          db,
          organizationId,
          String(args.contact_name),
          searchContext,
        )) ?? undefined;
        if (contactId == null) return "No contact found matching that name.";
      }
      if (dealId == null && args.deal_name) {
        dealId = (await resolveDealByName(
          db,
          organizationId,
          String(args.deal_name),
          searchContext,
        )) ?? undefined;
        if (dealId == null) return "No deal found matching that name.";
      }

      if (contactId != null) {
        const [contact] = await db
          .select({ id: schema.contacts.id })
          .from(schema.contacts)
          .where(
            and(
              eq(schema.contacts.id, contactId),
              eq(schema.contacts.organizationId, organizationId),
            ),
          )
          .limit(1);
        if (!contact) return "Error: Contact not found";

        const [data] = await db
          .insert(schema.contactNotes)
          .values({
            contactId,
            crmUserId,
            organizationId,
            text,
          })
          .returning({ id: schema.contactNotes.id });

        if (!data) {
          return "Error: Failed to add note";
        }
        return `Note added to contact (id: ${data.id})`;
      }

      if (dealId) {
        const [deal] = await db
          .select({ id: schema.deals.id })
          .from(schema.deals)
          .where(
            and(
              eq(schema.deals.id, dealId),
              eq(schema.deals.organizationId, organizationId),
            ),
          )
          .limit(1);
        if (!deal) return "Error: Deal not found";

        const [data] = await db
          .insert(schema.dealNotes)
          .values({
            dealId,
            crmUserId,
            organizationId,
            text,
          })
          .returning();

        if (!data) {
          return "Error: Failed to add note";
        }
        return `Note added to deal (id: ${(data as { id: number }).id})`;
      }

      return "Error: Must specify contact_id/contact_name or deal_id/deal_name";
    }

    if (toolName === "update_deal") {
      let dealId = args.deal_id as number | undefined;
      if (dealId == null && args.deal_name) {
        dealId = (await resolveDealByName(
          db,
          organizationId,
          String(args.deal_name),
          searchContext,
        )) ?? undefined;
        if (dealId == null) return "No deal found matching that name.";
      }
      if (dealId == null) return "Error: Provide deal_id or deal_name";
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (args.status !== undefined) updateData.status = args.status;
      if (args.name !== undefined) updateData.name = (args.name as string).trim();
      if (args.amount !== undefined) updateData.amount = args.amount;

      const [updated] = await db
        .update(schema.deals)
        .set(updateData)
        .where(
          and(
            eq(schema.deals.id, dealId),
            eq(schema.deals.organizationId, organizationId),
            isNull(schema.deals.archivedAt),
          ),
        )
        .returning();

      if (!updated) {
        return "Error: Deal not found or update failed";
      }
      return `Updated: ${mdLink(updated.name, "deals", updated.id)}`;
    }

    return `Unknown tool: ${toolName}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[assistant] tool execution error:", err);
    return `Error: ${msg}`;
  }
}
