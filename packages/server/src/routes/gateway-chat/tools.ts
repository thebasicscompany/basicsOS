import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import {
  type HybridSearchContext,
  resolveCompanyByName,
  resolveContactByName,
  resolveDealByName,
  searchCompaniesByQuery,
  searchContactsByQuery,
  searchDealsByQuery,
  searchTasksByQuery,
} from "@/lib/resolve-by-name.js";
import {
  addNoteSchema,
  completeTaskSchema,
  createCompanySchema,
  createContactSchema,
  createDealSchema,
  createNoteSchema,
  createTaskSchema,
  getCompanySchema,
  getContactSchema,
  getDealSchema,
  limitFrom,
  listNotesSchema,
  listTasksSchema,
  searchCompaniesSchema,
  searchContactsSchema,
  searchDealsSchema,
  searchTasksSchema,
  updateCompanySchema,
  updateContactSchema,
  updateDealSchema,
} from "@/routes/gateway-chat/protocol.js";

export type ToolExecutionContext = {
  env: Record<string, string>;
  gatewayUrl: string;
  gatewayHeaders: Record<string, string>;
};

type RecordRow = {
  id: number | string;
  name?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  companyName?: unknown;
  category?: unknown;
  domain?: unknown;
  description?: unknown;
  status?: unknown;
  amount?: unknown;
  text?: unknown;
  type?: unknown;
  dueDate?: unknown;
  contactId?: number | null;
  companyId?: number | null;
};

function mdLink(row: RecordRow, objectSlug: string): string {
  const name =
    (row.name as string | undefined) ??
    ([row.firstName, row.lastName].filter(Boolean).join(" ") || `#${row.id}`);
  return `[[${objectSlug}/${row.id}|${name}]]`;
}

function formatContact(row: RecordRow): string {
  const parts = [mdLink(row, "contacts")];
  if (row.email) parts.push(`Email: ${row.email}`);
  if (row.companyName) parts.push(`Company: ${row.companyName}`);
  return parts.join(" — ");
}

function formatDeal(row: RecordRow): string {
  const parts = [mdLink(row, "deals")];
  if (row.status) parts.push(`Status: ${row.status}`);
  if (row.amount != null) parts.push(`$${Number(row.amount).toLocaleString()}`);
  return parts.join(" — ");
}

function formatCompany(row: RecordRow): string {
  const parts = [mdLink(row, "companies")];
  if (row.category) parts.push(`Category: ${row.category}`);
  if (row.domain) parts.push(String(row.domain));
  if (row.description)
    parts.push(`Description: ${String(row.description).slice(0, 100)}`);
  return parts.join(" — ");
}

function formatTask(row: RecordRow): string {
  const name = (row.text as string | undefined) ?? `Task #${row.id}`;
  // Link to parent company or contact tasks tab; fallback to Tasks app if no parent
  const companyId = row.companyId ?? null;
  const contactId = row.contactId ?? null;
  const taskLink =
    companyId != null
      ? `[[companies/${companyId}#tasks|${name}]]`
      : contactId != null
        ? `[[contacts/${contactId}#tasks|${name}]]`
        : `[${name}](/tasks)`;
  const parts = [taskLink];
  if (row.type) parts.push(`Type: ${row.type}`);
  if (row.dueDate)
    parts.push(`Due: ${new Date(String(row.dueDate)).toLocaleDateString()}`);
  if (row.description) parts.push(String(row.description).slice(0, 80));
  return parts.join(" — ");
}

function formatRows(
  rows: RecordRow[],
  formatter: (r: RecordRow) => string,
): string {
  if (rows.length === 0) return "No results found.";
  return rows.map((r, i) => `${i + 1}. ${formatter(r)}`).join("\n");
}

function formatSingle(
  row: RecordRow | null,
  objectSlug: string,
  formatter: (r: RecordRow) => string,
): string {
  if (!row) return "Not found.";
  return `Found: ${formatter(row)}`;
}

function formatCreated(row: RecordRow | null, objectSlug: string): string {
  if (!row) return "Failed to create record.";
  return `Created: ${mdLink(row, objectSlug)} (id: ${row.id})`;
}

function formatUpdated(row: RecordRow | null, objectSlug: string): string {
  if (!row) return "Record not found.";
  return `Updated: ${mdLink(row, objectSlug)}`;
}

export async function executeValidatedTool(
  db: Db,
  crmUserId: number,
  organizationId: string,
  toolName: string,
  rawArgs: Record<string, unknown>,
  searchContext?: HybridSearchContext,
  ctx?: ToolExecutionContext,
): Promise<unknown> {
  const contactExists = async (contactId: number): Promise<boolean> => {
    const rows = await db
      .select({ id: schema.contacts.id })
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.id, contactId),
          eq(schema.contacts.organizationId, organizationId),
        ),
      )
      .limit(1);
    return Boolean(rows[0]);
  };
  const companyExists = async (companyId: number): Promise<boolean> => {
    const rows = await db
      .select({ id: schema.companies.id })
      .from(schema.companies)
      .where(
        and(
          eq(schema.companies.id, companyId),
          eq(schema.companies.organizationId, organizationId),
        ),
      )
      .limit(1);
    return Boolean(rows[0]);
  };

  if (toolName === "search_contacts") {
    const parsed = searchContactsSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const query = args.query?.trim() ?? "";
    const rows = await searchContactsByQuery(
      db,
      organizationId,
      query,
      searchContext,
      limitFrom(args.limit),
    );
    return formatRows(rows, formatContact);
  }

  if (toolName === "get_contact") {
    const parsed = getContactSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    let id = parsed.data.id;
    if (id == null && parsed.data.contact_name) {
      id =
        (await resolveContactByName(
          db,
          organizationId,
          parsed.data.contact_name,
          searchContext,
        )) ?? undefined;
      if (id == null) return "No contact found matching that name.";
    }
    if (id == null) return { error: "Provide id or contact_name" };
    const rows = await db
      .select()
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.id, id),
          eq(schema.contacts.organizationId, organizationId),
        ),
      )
      .limit(1);
    return formatSingle(rows[0] ?? null, "contacts", formatContact);
  }

  if (toolName === "create_contact") {
    const parsed = createContactSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    let companyId = args.company_id ?? null;
    if (companyId == null && args.company_name) {
      companyId = await resolveCompanyByName(
        db,
        organizationId,
        args.company_name,
        searchContext,
      );
    }
    const [row] = await db
      .insert(schema.contacts)
      .values({
        crmUserId,
        organizationId,
        firstName: args.first_name ?? null,
        lastName: args.last_name ?? null,
        email: args.email ?? null,
        companyId,
      })
      .returning();
    return row
      ? formatCreated(row, "contacts")
      : "Error: failed to create contact";
  }

  if (toolName === "update_contact") {
    const parsed = updateContactSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    let id = args.id;
    if (id == null && args.contact_name) {
      id =
        (await resolveContactByName(
          db,
          organizationId,
          args.contact_name,
          searchContext,
        )) ?? undefined;
      if (id == null) return "No contact found matching that name.";
    }
    if (id == null) return { error: "Provide id or contact_name" };
    const updates: Record<string, unknown> = {};
    if (args.first_name !== undefined) updates.firstName = args.first_name;
    if (args.last_name !== undefined) updates.lastName = args.last_name;
    if (args.email !== undefined) updates.email = args.email;

    const [row] = await db
      .update(schema.contacts)
      .set(updates)
      .where(
        and(
          eq(schema.contacts.id, id),
          eq(schema.contacts.organizationId, organizationId),
        ),
      )
      .returning();
    return row ? formatUpdated(row, "contacts") : "Error: contact not found";
  }

  if (toolName === "search_deals") {
    const parsed = searchDealsSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const query = args.query?.trim() ?? "";
    let rows = await searchDealsByQuery(
      db,
      organizationId,
      query,
      searchContext,
      limitFrom(args.limit),
    );
    if (args.status) rows = rows.filter((row) => row.status === args.status);
    return formatRows(rows, formatDeal);
  }

  if (toolName === "get_deal") {
    const parsed = getDealSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    let id = parsed.data.id;
    if (id == null && parsed.data.deal_name) {
      id =
        (await resolveDealByName(
          db,
          organizationId,
          parsed.data.deal_name,
          searchContext,
        )) ?? undefined;
      if (id == null) return "No deal found matching that name.";
    }
    if (id == null) return { error: "Provide id or deal_name" };
    const rows = await db
      .select()
      .from(schema.deals)
      .where(
        and(
          eq(schema.deals.id, id),
          eq(schema.deals.organizationId, organizationId),
          isNull(schema.deals.archivedAt),
        ),
      )
      .limit(1);
    return formatSingle(rows[0] ?? null, "deals", formatDeal);
  }

  if (toolName === "create_deal") {
    const parsed = createDealSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    let companyId = args.company_id ?? null;
    if (companyId == null && args.company_name) {
      companyId = await resolveCompanyByName(
        db,
        organizationId,
        args.company_name,
        searchContext,
      );
    }
    const [row] = await db
      .insert(schema.deals)
      .values({
        crmUserId,
        organizationId,
        name: args.name.trim(),
        status: args.status ?? "opportunity",
        companyId,
        amount: args.amount ?? null,
      })
      .returning();
    return row ? formatCreated(row, "deals") : "Error: failed to create deal";
  }

  if (toolName === "update_deal") {
    const parsed = updateDealSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    let id = args.id;
    if (id == null && args.deal_name) {
      id =
        (await resolveDealByName(
          db,
          organizationId,
          args.deal_name,
          searchContext,
        )) ?? undefined;
      if (id == null) return "No deal found matching that name.";
    }
    if (id == null) return { error: "Provide id or deal_name" };
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.status !== undefined) updates.status = args.status;
    if (args.amount !== undefined) updates.amount = args.amount;

    const [row] = await db
      .update(schema.deals)
      .set(updates)
      .where(
        and(
          eq(schema.deals.id, id),
          eq(schema.deals.organizationId, organizationId),
          isNull(schema.deals.archivedAt),
        ),
      )
      .returning();
    return row ? formatUpdated(row, "deals") : "Error: deal not found";
  }

  if (toolName === "search_companies") {
    const parsed = searchCompaniesSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const query = args.query?.trim() ?? "";
    const rows = await searchCompaniesByQuery(
      db,
      organizationId,
      query,
      searchContext,
      limitFrom(args.limit),
    );
    return formatRows(rows, formatCompany);
  }

  if (toolName === "get_company") {
    const parsed = getCompanySchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    let id = parsed.data.id;
    if (id == null && parsed.data.company_name) {
      id =
        (await resolveCompanyByName(
          db,
          organizationId,
          parsed.data.company_name,
          searchContext,
        )) ?? undefined;
      if (id == null) return "No company found matching that name.";
    }
    if (id == null) return { error: "Provide id or company_name" };
    const rows = await db
      .select()
      .from(schema.companies)
      .where(
        and(
          eq(schema.companies.id, id),
          eq(schema.companies.organizationId, organizationId),
        ),
      )
      .limit(1);
    return formatSingle(rows[0] ?? null, "companies", formatCompany);
  }

  if (toolName === "create_company") {
    const parsed = createCompanySchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const [row] = await db
      .insert(schema.companies)
      .values({
        crmUserId,
        organizationId,
        name: args.name.trim(),
        category: args.category ?? null,
        domain: args.domain ?? null,
        description: args.description ?? null,
      })
      .returning();
    return row
      ? formatCreated(row, "companies")
      : "Error: failed to create company";
  }

  if (toolName === "update_company") {
    const parsed = updateCompanySchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    let id = args.id;
    if (id == null && args.company_name) {
      id =
        (await resolveCompanyByName(
          db,
          organizationId,
          args.company_name,
          searchContext,
        )) ?? undefined;
      if (id == null) return "No company found matching that name.";
    }
    if (id == null) return { error: "Provide id or company_name" };
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.category !== undefined) updates.category = args.category;
    if (args.domain !== undefined) updates.domain = args.domain;
    if (args.description !== undefined) updates.description = args.description;

    const [row] = await db
      .update(schema.companies)
      .set(updates)
      .where(
        and(
          eq(schema.companies.id, id),
          eq(schema.companies.organizationId, organizationId),
        ),
      )
      .returning();
    return row ? formatUpdated(row, "companies") : "Error: company not found";
  }

  if (toolName === "search_tasks") {
    const parsed = searchTasksSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const query = args.query?.trim() ?? "";
    const rows = await searchTasksByQuery(
      db,
      organizationId,
      query,
      searchContext,
      limitFrom(args.limit),
    );
    return formatRows(rows, formatTask);
  }

  if (toolName === "list_tasks") {
    const parsed = listTasksSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const byContact = args.contact_id ?? args.contact_name;
    const byCompany = args.company_id ?? args.company_name;
    if (byContact) {
      let contactId = args.contact_id;
      if (contactId == null && args.contact_name) {
        contactId =
          (await resolveContactByName(
            db,
            organizationId,
            args.contact_name,
            searchContext,
          )) ?? undefined;
        if (contactId == null) return "No contact found matching that name.";
      }
      if (contactId == null)
        return { error: "Provide contact_id or contact_name" };
      const rows = await db
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.organizationId, organizationId),
            eq(schema.tasks.contactId, contactId),
          ),
        )
        .orderBy(desc(schema.tasks.id))
        .limit(limitFrom(args.limit));
      return formatRows(rows, formatTask);
    }
    if (byCompany) {
      let companyId = args.company_id;
      if (companyId == null && args.company_name) {
        companyId =
          (await resolveCompanyByName(
            db,
            organizationId,
            args.company_name,
            searchContext,
          )) ?? undefined;
        if (companyId == null) return "No company found matching that name.";
      }
      if (companyId == null)
        return { error: "Provide company_id or company_name" };
      const rows = await db
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.organizationId, organizationId),
            eq(schema.tasks.companyId, companyId),
          ),
        )
        .orderBy(desc(schema.tasks.id))
        .limit(limitFrom(args.limit));
      return formatRows(rows, formatTask);
    }
    return {
      error: "Provide contact_id/contact_name or company_id/company_name",
    };
  }

  if (toolName === "create_task") {
    const parsed = createTaskSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const byContact = args.contact_id ?? args.contact_name;
    const byCompany = args.company_id ?? args.company_name;
    let contactId: number | null = null;
    let companyId: number | null = null;
    if (byContact) {
      contactId = args.contact_id ?? null;
      if (contactId == null && args.contact_name) {
        contactId =
          (await resolveContactByName(
            db,
            organizationId,
            args.contact_name,
            searchContext,
          )) ?? null;
        if (contactId == null) return "No contact found matching that name.";
      }
      if (!(await contactExists(contactId!)))
        return { error: "contact not found" };
    }
    if (byCompany) {
      companyId = args.company_id ?? null;
      if (companyId == null && args.company_name) {
        companyId =
          (await resolveCompanyByName(
            db,
            organizationId,
            args.company_name,
            searchContext,
          )) ?? null;
        if (companyId == null) return "No company found matching that name.";
      }
      if (!(await companyExists(companyId!)))
        return { error: "company not found" };
    }
    if (!contactId && !companyId)
      return {
        error: "Provide contact_id/contact_name or company_id/company_name",
      };

    let dueDate: Date | null = null;
    if (args.due_date) {
      const parsedDate = new Date(args.due_date);
      if (!Number.isNaN(parsedDate.getTime())) dueDate = parsedDate;
    }

    const [row] = await db
      .insert(schema.tasks)
      .values({
        crmUserId,
        organizationId,
        contactId,
        companyId,
        text: args.text.trim(),
        type: args.type ?? "call",
        dueDate,
      })
      .returning();
    return row ?? { error: "failed to create task" };
  }

  if (toolName === "complete_task") {
    const parsed = completeTaskSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const [row] = await db
      .update(schema.tasks)
      .set({ doneDate: new Date() })
      .where(
        and(
          eq(schema.tasks.id, parsed.data.id),
          eq(schema.tasks.organizationId, organizationId),
        ),
      )
      .returning();
    return row ?? { error: "task not found" };
  }

  if (toolName === "list_notes") {
    const parsed = listNotesSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    let contactId = args.contact_id;
    if (contactId == null && args.contact_name) {
      contactId =
        (await resolveContactByName(
          db,
          organizationId,
          args.contact_name,
          searchContext,
        )) ?? undefined;
      if (contactId == null) return "No contact found matching that name.";
    }
    if (contactId == null)
      return { error: "Provide contact_id or contact_name" };
    return db
      .select()
      .from(schema.contactNotes)
      .where(
        and(
          eq(schema.contactNotes.organizationId, organizationId),
          eq(schema.contactNotes.contactId, contactId),
        ),
      )
      .orderBy(desc(schema.contactNotes.id))
      .limit(limitFrom(args.limit));
  }

  if (toolName === "create_note") {
    const parsed = createNoteSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    let contactId = args.contact_id;
    if (contactId == null && args.contact_name) {
      contactId =
        (await resolveContactByName(
          db,
          organizationId,
          args.contact_name,
          searchContext,
        )) ?? undefined;
      if (contactId == null) return "No contact found matching that name.";
    }
    if (contactId == null)
      return { error: "Provide contact_id or contact_name" };
    if (!(await contactExists(contactId)))
      return { error: "contact not found" };

    const [row] = await db
      .insert(schema.contactNotes)
      .values({
        crmUserId,
        organizationId,
        contactId,
        text: args.text.trim(),
        status: args.type ?? null,
      })
      .returning();
    return row ?? { error: "failed to create note" };
  }

  if (toolName === "add_note") {
    const parsed = addNoteSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    let contactId = args.contact_id;
    let dealId = args.deal_id;
    if (contactId == null && args.contact_name) {
      contactId =
        (await resolveContactByName(
          db,
          organizationId,
          args.contact_name,
          searchContext,
        )) ?? undefined;
      if (contactId == null) return "No contact found matching that name.";
    }
    if (dealId == null && args.deal_name) {
      dealId =
        (await resolveDealByName(
          db,
          organizationId,
          args.deal_name,
          searchContext,
        )) ?? undefined;
      if (dealId == null) return "No deal found matching that name.";
    }

    if (contactId != null) {
      if (!(await contactExists(contactId)))
        return { error: "contact not found" };
      const [row] = await db
        .insert(schema.contactNotes)
        .values({
          crmUserId,
          organizationId,
          contactId,
          text: args.text.trim(),
          status: null,
        })
        .returning();
      return row
        ? `Note added to contact (id: ${row.id})`
        : { error: "failed to add note" };
    }

    if (dealId != null) {
      const [deal] = await db
        .select({ id: schema.deals.id })
        .from(schema.deals)
        .where(
          and(
            eq(schema.deals.id, dealId),
            eq(schema.deals.organizationId, organizationId),
            isNull(schema.deals.archivedAt),
          ),
        )
        .limit(1);
      if (!deal) return { error: "deal not found" };

      const [row] = await db
        .insert(schema.dealNotes)
        .values({
          crmUserId,
          organizationId,
          dealId,
          text: args.text.trim(),
        })
        .returning();
      return row
        ? `Note added to deal (id: ${row.id})`
        : { error: "failed to add note" };
    }

    return {
      error: "Must specify contact_id/contact_name or deal_id/deal_name",
    };
  }

  return { error: `Unknown tool: ${toolName}` };
}
