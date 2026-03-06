import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import {
  completeTaskSchema,
  createCompanySchema,
  createContactSchema,
  createDealSchema,
  createNoteSchema,
  createTaskSchema,
  getContactSchema,
  getDealSchema,
  limitFrom,
  listNotesSchema,
  listTasksSchema,
  searchCompaniesSchema,
  searchContactsSchema,
  searchDealsSchema,
  updateContactSchema,
  updateDealSchema,
} from "@/routes/gateway-chat/protocol.js";

export async function executeValidatedTool(
  db: Db,
  crmUserId: number,
  organizationId: string,
  toolName: string,
  rawArgs: Record<string, unknown>,
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

  if (toolName === "search_contacts") {
    const parsed = searchContactsSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const query = args.query?.trim() ?? "";
    const conditions = [eq(schema.contacts.organizationId, organizationId)];
    if (query) {
      conditions.push(
        or(
          ilike(schema.contacts.firstName, `%${query}%`),
          ilike(schema.contacts.lastName, `%${query}%`),
          ilike(schema.contacts.email, `%${query}%`),
        )!,
      );
    }
    return db
      .select()
      .from(schema.contacts)
      .where(and(...conditions))
      .limit(limitFrom(args.limit));
  }

  if (toolName === "get_contact") {
    const parsed = getContactSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const rows = await db
      .select()
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.id, parsed.data.id),
          eq(schema.contacts.organizationId, organizationId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  if (toolName === "create_contact") {
    const parsed = createContactSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const [row] = await db
      .insert(schema.contacts)
      .values({
        crmUserId,
        organizationId,
        firstName: args.first_name ?? null,
        lastName: args.last_name ?? null,
        email: args.email ?? null,
        companyId: args.company_id ?? null,
      })
      .returning();
    return row ?? { error: "failed to create contact" };
  }

  if (toolName === "update_contact") {
    const parsed = updateContactSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const updates: Record<string, unknown> = {};
    if (args.first_name !== undefined) updates.firstName = args.first_name;
    if (args.last_name !== undefined) updates.lastName = args.last_name;
    if (args.email !== undefined) updates.email = args.email;

    const [row] = await db
      .update(schema.contacts)
      .set(updates)
      .where(
        and(
          eq(schema.contacts.id, args.id),
          eq(schema.contacts.organizationId, organizationId),
        ),
      )
      .returning();
    return row ?? { error: "contact not found" };
  }

  if (toolName === "search_deals") {
    const parsed = searchDealsSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const query = args.query?.trim() ?? "";
    const conditions = [
      eq(schema.deals.organizationId, organizationId),
      isNull(schema.deals.archivedAt),
    ];
    if (query) conditions.push(ilike(schema.deals.name, `%${query}%`));
    if (args.status) conditions.push(eq(schema.deals.status, args.status));
    return db
      .select()
      .from(schema.deals)
      .where(and(...conditions))
      .limit(limitFrom(args.limit));
  }

  if (toolName === "get_deal") {
    const parsed = getDealSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const rows = await db
      .select()
      .from(schema.deals)
      .where(
        and(
          eq(schema.deals.id, parsed.data.id),
          eq(schema.deals.organizationId, organizationId),
          isNull(schema.deals.archivedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  if (toolName === "create_deal") {
    const parsed = createDealSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const [row] = await db
      .insert(schema.deals)
      .values({
        crmUserId,
        organizationId,
        name: args.name.trim(),
        status: args.status ?? "opportunity",
        companyId: args.company_id ?? null,
        amount: args.amount ?? null,
      })
      .returning();
    return row ?? { error: "failed to create deal" };
  }

  if (toolName === "update_deal") {
    const parsed = updateDealSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.status !== undefined) updates.status = args.status;
    if (args.amount !== undefined) updates.amount = args.amount;

    const [row] = await db
      .update(schema.deals)
      .set(updates)
      .where(
        and(
          eq(schema.deals.id, args.id),
          eq(schema.deals.organizationId, organizationId),
          isNull(schema.deals.archivedAt),
        ),
      )
      .returning();
    return row ?? { error: "deal not found" };
  }

  if (toolName === "search_companies") {
    const parsed = searchCompaniesSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    const query = args.query?.trim() ?? "";
    const conditions = [eq(schema.companies.organizationId, organizationId)];
    if (query) {
      conditions.push(
        or(
          ilike(schema.companies.name, `%${query}%`),
          ilike(schema.companies.category, `%${query}%`),
        )!,
      );
    }
    return db
      .select()
      .from(schema.companies)
      .where(and(...conditions))
      .limit(limitFrom(args.limit));
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
      })
      .returning();
    return row ?? { error: "failed to create company" };
  }

  if (toolName === "list_tasks") {
    const parsed = listTasksSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;
    return db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.organizationId, organizationId),
          eq(schema.tasks.contactId, args.contact_id),
        ),
      )
      .orderBy(desc(schema.tasks.id))
      .limit(limitFrom(args.limit));
  }

  if (toolName === "create_task") {
    const parsed = createTaskSchema.safeParse(rawArgs);
    if (!parsed.success)
      return { error: "Invalid arguments", details: parsed.error.flatten() };
    const args = parsed.data;

    if (!(await contactExists(args.contact_id)))
      return { error: "contact not found" };

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
        contactId: args.contact_id,
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
    return db
      .select()
      .from(schema.contactNotes)
      .where(
        and(
          eq(schema.contactNotes.organizationId, organizationId),
          eq(schema.contactNotes.contactId, args.contact_id),
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
    if (!(await contactExists(args.contact_id)))
      return { error: "contact not found" };

    const [row] = await db
      .insert(schema.contactNotes)
      .values({
        crmUserId,
        organizationId,
        contactId: args.contact_id,
        text: args.text.trim(),
        status: args.type ?? null,
      })
      .returning();
    return row ?? { error: "failed to create note" };
  }

  return { error: `Unknown tool: ${toolName}` };
}
