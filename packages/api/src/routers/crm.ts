import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, inArray, lt, notInArray, or, isNull, isNotNull, gt, sql } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure, adminProcedure } from "../trpc.js";
import { contacts, companies, deals, dealActivities, pipelineStages, crmSavedViews, crmAuditLog, crmNotes, crmFavorites, customFieldDefs, crmAttachments } from "@basicsos/db";
import type { DbConnection } from "@basicsos/db";
import { EventBus, createEvent } from "../events/bus.js";

// ---------------------------------------------------------------------------
// Audit log helper
// ---------------------------------------------------------------------------

async function logAuditChanges(
  db: DbConnection,
  tenantId: string,
  userId: string,
  entity: string,
  recordId: string,
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
): Promise<void> {
  const entries: (typeof crmAuditLog.$inferInsert)[] = [];
  for (const key of Object.keys(newRecord)) {
    const oldVal = oldRecord[key];
    const newVal = newRecord[key];
    if (oldVal !== newVal) {
      entries.push({
        tenantId,
        entity,
        recordId,
        userId,
        field: key,
        oldValue: oldVal != null ? String(oldVal) : null,
        newValue: newVal != null ? String(newVal) : null,
      });
    }
  }
  if (entries.length > 0) {
    await db.insert(crmAuditLog).values(entries);
  }
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

const contactsSubRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(500),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId)
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });

      const { search, limit } = input;

      const rows = await ctx.db
        .select()
        .from(contacts)
        .where(
          search
            ? and(
                eq(contacts.tenantId, ctx.tenantId),
                isNull(contacts.deletedAt),
                or(
                  ilike(contacts.name, `%${search.replace(/[%_\\]/g, "\\$&")}%`),
                  ilike(contacts.email, `%${search.replace(/[%_\\]/g, "\\$&")}%`),
                ),
              )
            : and(eq(contacts.tenantId, ctx.tenantId), isNull(contacts.deletedAt)),
        )
        .limit(limit);

      return rows;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId)
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });

      const [contact] = await ctx.db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, input.id),
            eq(contacts.tenantId, ctx.tenantId),
            isNull(contacts.deletedAt),
          ),
        );

      if (!contact) throw new TRPCError({ code: "NOT_FOUND" });
      return contact;
    }),

  create: memberProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        companyId: z.string().uuid().optional(),
        customFields: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [contact] = await ctx.db
        .insert(contacts)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          companyId: input.companyId,
          customFields: input.customFields ?? {},
          createdBy: ctx.userId,
        })
        .returning();

      if (!contact) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      EventBus.emit(
        createEvent({
          type: "crm.contact.created",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { contactId: contact.id },
        }),
      );

      return contact;
    }),

  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        companyId: z.string().uuid().optional(),
        customFields: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;

      const [existing] = await ctx.db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId)));

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db
        .update(contacts)
        .set({
          ...fields,
          updatedAt: new Date(),
        })
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      const oldRecord: Record<string, unknown> = {
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        companyId: existing.companyId,
      };
      const newRecord: Record<string, unknown> = {
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        companyId: updated.companyId,
      };

      await logAuditChanges(
        ctx.db,
        ctx.tenantId,
        ctx.userId,
        "contact",
        id,
        oldRecord,
        newRecord,
      );

      return updated;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(contacts)
        .set({ deletedAt: new Date() })
        .where(and(eq(contacts.id, input.id), eq(contacts.tenantId, ctx.tenantId)))
        .returning({ id: contacts.id });

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      EventBus.emit(
        createEvent({
          type: "crm.contact.deleted",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { contactId: input.id },
        }),
      );

      return { id: updated.id };
    }),

  import: memberProcedure
    .input(
      z.object({
        rows: z
          .array(
            z.object({
              name: z.string().min(1),
              email: z.string().email().optional(),
              phone: z.string().optional(),
              companyId: z.string().uuid().optional(),
              customFields: z.record(z.unknown()).optional(),
            }),
          )
          .min(1)
          .max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const inserted = await ctx.db
        .insert(contacts)
        .values(
          input.rows.map((row) => ({
            ...row,
            tenantId: ctx.tenantId,
            createdBy: ctx.userId,
            customFields: row.customFields ?? {},
          })),
        )
        .returning({ id: contacts.id });

      EventBus.emit(
        createEvent({
          type: "crm.contacts.imported",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { count: inserted.length },
        }),
      );

      return { imported: inserted.length };
    }),

  findDuplicates: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const emailDupes = await ctx.db.execute(sql`
      SELECT c1.id as id1, c1.name as name1, c1.email as email1,
             c2.id as id2, c2.name as name2, c2.email as email2,
             'email' as reason
      FROM contacts c1
      JOIN contacts c2 ON c1.email = c2.email AND c1.id < c2.id
      WHERE c1.tenant_id = ${ctx.tenantId}::uuid
        AND c1.email IS NOT NULL
        AND c1.deleted_at IS NULL AND c2.deleted_at IS NULL
      LIMIT 20
    `);

    const nameDupes = await ctx.db.execute(sql`
      SELECT c1.id as id1, c1.name as name1, c1.email as email1,
             c2.id as id2, c2.name as name2, c2.email as email2,
             'name' as reason
      FROM contacts c1
      JOIN contacts c2 ON similarity(c1.name, c2.name) > 0.7 AND c1.id < c2.id
      WHERE c1.tenant_id = ${ctx.tenantId}::uuid
        AND c1.deleted_at IS NULL AND c2.deleted_at IS NULL
      LIMIT 20
    `);

    return [...(emailDupes.rows as unknown[]), ...(nameDupes.rows as unknown[])] as Array<{
      id1: string;
      name1: string;
      email1: string | null;
      id2: string;
      name2: string;
      email2: string | null;
      reason: string;
    }>;
  }),

  merge: memberProcedure
    .input(
      z.object({
        winnerId: z.string().uuid(),
        loserId: z.string().uuid(),
        keepFields: z
          .object({
            name: z.enum(["winner", "loser"]).default("winner"),
            email: z.enum(["winner", "loser"]).default("winner"),
            phone: z.enum(["winner", "loser"]).default("winner"),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [winner, loser] = await Promise.all([
        ctx.db
          .select()
          .from(contacts)
          .where(and(eq(contacts.id, input.winnerId), eq(contacts.tenantId, ctx.tenantId)))
          .then((r) => r[0]),
        ctx.db
          .select()
          .from(contacts)
          .where(and(eq(contacts.id, input.loserId), eq(contacts.tenantId, ctx.tenantId)))
          .then((r) => r[0]),
      ]);

      if (!winner || !loser) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .update(deals)
        .set({ contactId: input.winnerId })
        .where(and(eq(deals.contactId, input.loserId), eq(deals.tenantId, ctx.tenantId)));

      const keep = input.keepFields;
      const patch: { name?: string; email?: string | null; phone?: string | null } = {};
      if (keep?.name === "loser") patch.name = loser.name;
      if (keep?.email === "loser") patch.email = loser.email;
      if (keep?.phone === "loser") patch.phone = loser.phone;

      if (Object.keys(patch).length > 0) {
        await ctx.db
          .update(contacts)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(contacts.id, input.winnerId));
      }

      await ctx.db
        .update(contacts)
        .set({ deletedAt: new Date() })
        .where(eq(contacts.id, input.loserId));

      EventBus.emit(
        createEvent({
          type: "crm.contact.merged",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { winnerId: input.winnerId, loserId: input.loserId },
        }),
      );

      return { merged: true, winnerId: input.winnerId };
    }),

  bulkUpdate: memberProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        patch: z.object({
          name: z.string().min(1).max(255).optional(),
          email: z.string().email().optional().nullable(),
          phone: z.string().optional().nullable(),
          companyId: z.string().uuid().optional().nullable(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db
        .update(contacts)
        .set({ ...input.patch, updatedAt: new Date() })
        .where(
          and(
            eq(contacts.tenantId, ctx.tenantId),
            inArray(contacts.id, input.ids),
          ),
        )
        .returning({ id: contacts.id });
      return { updated: updated.length };
    }),

  enrichFromDomain: protectedProcedure
    .input(z.object({ contactId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const [contact] = await ctx.db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.tenantId, ctx.tenantId)));

      if (!contact?.email) return null;

      const emailDomain = contact.email.split("@")[1];
      if (!emailDomain) return null;

      // Already linked — no suggestion needed
      if (contact.companyId) return null;

      const matchingCompanies = await ctx.db
        .select({ id: companies.id, name: companies.name, domain: companies.domain })
        .from(companies)
        .where(and(eq(companies.tenantId, ctx.tenantId), eq(companies.domain, emailDomain)))
        .limit(3);

      if (matchingCompanies.length === 0) return null;
      return { emailDomain, suggestions: matchingCompanies };
    }),

  linkToCompany: memberProcedure
    .input(
      z.object({
        contactId: z.string().uuid(),
        companyId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(contacts)
        .set({ companyId: input.companyId, updatedAt: new Date() })
        .where(and(eq(contacts.id, input.contactId), eq(contacts.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      EventBus.emit(
        createEvent({
          type: "crm.contact.linked_company",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { contactId: input.contactId, companyId: input.companyId },
        }),
      );

      return updated;
    }),
});

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

const companiesSubRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });

    return ctx.db
      .select()
      .from(companies)
      .where(and(eq(companies.tenantId, ctx.tenantId), isNull(companies.deletedAt)));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId)
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });

      const [company] = await ctx.db
        .select()
        .from(companies)
        .where(
          and(
            eq(companies.id, input.id),
            eq(companies.tenantId, ctx.tenantId),
            isNull(companies.deletedAt),
          ),
        );

      if (!company) throw new TRPCError({ code: "NOT_FOUND" });

      const linkedContacts = await ctx.db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.companyId, input.id),
            eq(contacts.tenantId, ctx.tenantId),
            isNull(contacts.deletedAt),
          ),
        );

      return { ...company, contacts: linkedContacts };
    }),

  create: memberProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        domain: z.string().optional(),
        industry: z.string().optional(),
        customFields: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [company] = await ctx.db
        .insert(companies)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          domain: input.domain,
          industry: input.industry,
          customFields: input.customFields ?? {},
        })
        .returning();

      if (!company) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      EventBus.emit(
        createEvent({
          type: "crm.company.created",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { companyId: company.id },
        }),
      );

      return company;
    }),

  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        domain: z.string().optional(),
        industry: z.string().optional(),
        customFields: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;

      const [existing] = await ctx.db
        .select()
        .from(companies)
        .where(and(eq(companies.id, id), eq(companies.tenantId, ctx.tenantId)));

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db
        .update(companies)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(companies.id, id), eq(companies.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      const oldRecord: Record<string, unknown> = {
        name: existing.name,
        domain: existing.domain,
        industry: existing.industry,
      };
      const newRecord: Record<string, unknown> = {
        name: updated.name,
        domain: updated.domain,
        industry: updated.industry,
      };

      await logAuditChanges(
        ctx.db,
        ctx.tenantId,
        ctx.userId,
        "company",
        id,
        oldRecord,
        newRecord,
      );

      return updated;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(companies)
        .set({ deletedAt: new Date() })
        .where(and(eq(companies.id, input.id), eq(companies.tenantId, ctx.tenantId)))
        .returning({ id: companies.id });

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      EventBus.emit(
        createEvent({
          type: "crm.company.deleted",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { companyId: input.id },
        }),
      );

      return { id: updated.id };
    }),

  import: memberProcedure
    .input(
      z.object({
        rows: z
          .array(
            z.object({
              name: z.string().min(1),
              domain: z.string().optional(),
              industry: z.string().optional(),
              customFields: z.record(z.unknown()).optional(),
            }),
          )
          .min(1)
          .max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const inserted = await ctx.db
        .insert(companies)
        .values(
          input.rows.map((row) => ({
            ...row,
            tenantId: ctx.tenantId,
            customFields: row.customFields ?? {},
          })),
        )
        .returning({ id: companies.id });

      return { imported: inserted.length };
    }),

  findDuplicates: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const nameDupes = await ctx.db.execute(sql`
      SELECT co1.id as id1, co1.name as name1, co1.domain as domain1,
             co2.id as id2, co2.name as name2, co2.domain as domain2,
             'name' as reason
      FROM companies co1
      JOIN companies co2 ON similarity(co1.name, co2.name) > 0.7 AND co1.id < co2.id
      WHERE co1.tenant_id = ${ctx.tenantId}::uuid
        AND co1.deleted_at IS NULL AND co2.deleted_at IS NULL
      LIMIT 20
    `);

    const domainDupes = await ctx.db.execute(sql`
      SELECT co1.id as id1, co1.name as name1, co1.domain as domain1,
             co2.id as id2, co2.name as name2, co2.domain as domain2,
             'domain' as reason
      FROM companies co1
      JOIN companies co2 ON co1.domain = co2.domain AND co1.id < co2.id
      WHERE co1.tenant_id = ${ctx.tenantId}::uuid
        AND co1.domain IS NOT NULL
        AND co1.deleted_at IS NULL AND co2.deleted_at IS NULL
      LIMIT 20
    `);

    return [...(nameDupes.rows as unknown[]), ...(domainDupes.rows as unknown[])] as Array<{
      id1: string;
      name1: string;
      domain1: string | null;
      id2: string;
      name2: string;
      domain2: string | null;
      reason: string;
    }>;
  }),

  merge: memberProcedure
    .input(
      z.object({
        winnerId: z.string().uuid(),
        loserId: z.string().uuid(),
        keepFields: z
          .object({
            name: z.enum(["winner", "loser"]).default("winner"),
            domain: z.enum(["winner", "loser"]).default("winner"),
            industry: z.enum(["winner", "loser"]).default("winner"),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [winner, loser] = await Promise.all([
        ctx.db
          .select()
          .from(companies)
          .where(and(eq(companies.id, input.winnerId), eq(companies.tenantId, ctx.tenantId)))
          .then((r) => r[0]),
        ctx.db
          .select()
          .from(companies)
          .where(and(eq(companies.id, input.loserId), eq(companies.tenantId, ctx.tenantId)))
          .then((r) => r[0]),
      ]);

      if (!winner || !loser) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .update(contacts)
        .set({ companyId: input.winnerId })
        .where(and(eq(contacts.companyId, input.loserId), eq(contacts.tenantId, ctx.tenantId)));

      await ctx.db
        .update(deals)
        .set({ companyId: input.winnerId })
        .where(and(eq(deals.companyId, input.loserId), eq(deals.tenantId, ctx.tenantId)));

      const keep = input.keepFields;
      const patch: { name?: string; domain?: string | null; industry?: string | null } = {};
      if (keep?.name === "loser") patch.name = loser.name;
      if (keep?.domain === "loser") patch.domain = loser.domain;
      if (keep?.industry === "loser") patch.industry = loser.industry;

      if (Object.keys(patch).length > 0) {
        await ctx.db
          .update(companies)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(companies.id, input.winnerId));
      }

      await ctx.db
        .update(companies)
        .set({ deletedAt: new Date() })
        .where(eq(companies.id, input.loserId));

      EventBus.emit(
        createEvent({
          type: "crm.company.merged",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { winnerId: input.winnerId, loserId: input.loserId },
        }),
      );

      return { merged: true, winnerId: input.winnerId };
    }),

  bulkUpdate: memberProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        patch: z.object({
          name: z.string().min(1).max(255).optional(),
          domain: z.string().optional().nullable(),
          industry: z.string().optional().nullable(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db
        .update(companies)
        .set({ ...input.patch, updatedAt: new Date() })
        .where(
          and(
            eq(companies.tenantId, ctx.tenantId),
            inArray(companies.id, input.ids),
          ),
        )
        .returning({ id: companies.id });
      return { updated: updated.length };
    }),
});

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

const dealsSubRouter = router({
  listByStage: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });

    const rows = await ctx.db
      .select()
      .from(deals)
      .where(and(eq(deals.tenantId, ctx.tenantId), isNull(deals.deletedAt)));

    const grouped: Record<string, typeof rows> = {};
    for (const deal of rows) {
      const stage = deal.stage;
      if (!grouped[stage]) grouped[stage] = [];
      grouped[stage].push(deal);
    }

    return Object.entries(grouped).map(([stage, dealList]) => ({ stage, deals: dealList }));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId)
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });

      const [deal] = await ctx.db
        .select()
        .from(deals)
        .where(
          and(
            eq(deals.id, input.id),
            eq(deals.tenantId, ctx.tenantId),
            isNull(deals.deletedAt),
          ),
        );

      if (!deal) throw new TRPCError({ code: "NOT_FOUND" });

      const activities = await ctx.db
        .select()
        .from(dealActivities)
        .where(eq(dealActivities.dealId, input.id));

      return { ...deal, activities };
    }),

  create: memberProcedure
    .input(
      z.object({
        title: z.string().min(1).max(512),
        companyId: z.string().uuid().optional(),
        contactId: z.string().uuid().optional(),
        stage: z.string().optional(),
        value: z.string().optional(),
        probability: z.number().int().min(0).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [deal] = await ctx.db
        .insert(deals)
        .values({
          tenantId: ctx.tenantId,
          title: input.title,
          companyId: input.companyId,
          contactId: input.contactId,
          stage: input.stage ?? "lead",
          value: input.value ?? "0",
          probability: input.probability ?? 50,
          createdBy: ctx.userId,
        })
        .returning();

      if (!deal) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return deal;
    }),

  updateStage: memberProcedure
    .input(z.object({ id: z.string().uuid(), stage: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(deals)
        .where(and(eq(deals.id, input.id), eq(deals.tenantId, ctx.tenantId)));

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db
        .update(deals)
        .set({ stage: input.stage, updatedAt: new Date() })
        .where(and(eq(deals.id, input.id), eq(deals.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logAuditChanges(
        ctx.db,
        ctx.tenantId,
        ctx.userId,
        "deal",
        input.id,
        { stage: existing.stage },
        { stage: input.stage },
      );

      EventBus.emit(
        createEvent({
          type: "crm.deal.stage_changed",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { dealId: updated.id, fromStage: existing.stage, toStage: input.stage },
        }),
      );

      if (input.stage === "won") {
        EventBus.emit(
          createEvent({
            type: "crm.deal.won",
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            payload: { dealId: updated.id, value: updated.value },
          }),
        );
      } else if (input.stage === "lost") {
        EventBus.emit(
          createEvent({
            type: "crm.deal.lost",
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            payload: { dealId: updated.id },
          }),
        );
      }

      return updated;
    }),

  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(512).optional(),
        companyId: z.string().uuid().optional(),
        contactId: z.string().uuid().optional(),
        value: z.string().optional(),
        probability: z.number().int().min(0).max(100).optional(),
        customFields: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;

      const [existing] = await ctx.db
        .select()
        .from(deals)
        .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId)));

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db
        .update(deals)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      const oldRecord: Record<string, unknown> = {
        title: existing.title,
        companyId: existing.companyId,
        contactId: existing.contactId,
        value: existing.value,
        probability: existing.probability,
      };
      const newRecord: Record<string, unknown> = {
        title: updated.title,
        companyId: updated.companyId,
        contactId: updated.contactId,
        value: updated.value,
        probability: updated.probability,
      };

      await logAuditChanges(
        ctx.db,
        ctx.tenantId,
        ctx.userId,
        "deal",
        id,
        oldRecord,
        newRecord,
      );

      return updated;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(deals)
        .set({ deletedAt: new Date() })
        .where(and(eq(deals.id, input.id), eq(deals.tenantId, ctx.tenantId)))
        .returning({ id: deals.id });

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      EventBus.emit(
        createEvent({
          type: "crm.deal.deleted",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { dealId: input.id },
        }),
      );

      return { id: updated.id };
    }),

  listOverdue: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });

    const now = new Date();
    return ctx.db
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.tenantId, ctx.tenantId),
          lt(deals.closeDate, now),
          notInArray(deals.stage, ["won", "lost"]),
        ),
      );
  }),

  bulkUpdate: memberProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        patch: z.object({
          stage: z.string().optional(),
          value: z.string().optional(),
          probability: z.number().int().min(0).max(100).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db
        .update(deals)
        .set({ ...input.patch, updatedAt: new Date() })
        .where(
          and(
            eq(deals.tenantId, ctx.tenantId),
            inArray(deals.id, input.ids),
          ),
        )
        .returning({ id: deals.id });
      return { updated: updated.length };
    }),
});

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

const activitiesSubRouter = router({
  list: protectedProcedure
    .input(z.object({ dealId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId)
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });

      return ctx.db.select().from(dealActivities).where(eq(dealActivities.dealId, input.dealId));
    }),

  create: memberProcedure
    .input(
      z.object({
        dealId: z.string().uuid(),
        type: z.enum(["note", "email", "call", "meeting"]),
        content: z.string().min(1),
        meetingId: z.string().uuid().optional(),
        subject: z.string().max(500).optional(),
        direction: z.enum(["inbound", "outbound"]).optional(),
        activityDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [activity] = await ctx.db
        .insert(dealActivities)
        .values({
          dealId: input.dealId,
          type: input.type,
          content: input.content,
          meetingId: input.meetingId,
          subject: input.subject,
          direction: input.direction,
          activityDate: input.activityDate ? new Date(input.activityDate) : undefined,
          createdBy: ctx.userId,
        })
        .returning();

      if (!activity) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      EventBus.emit(
        createEvent({
          type: "crm.activity.logged",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { activityId: activity.id, dealId: input.dealId },
        }),
      );

      return activity;
    }),

  logEmail: memberProcedure
    .input(
      z.object({
        dealId: z.string().uuid(),
        subject: z.string().min(1).max(500),
        content: z.string().max(2000).default(""),
        direction: z.enum(["inbound", "outbound"]),
        activityDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [activity] = await ctx.db
        .insert(dealActivities)
        .values({
          dealId: input.dealId,
          type: "email",
          content: input.content,
          subject: input.subject,
          direction: input.direction,
          activityDate: input.activityDate ? new Date(input.activityDate) : new Date(),
          createdBy: ctx.userId,
        })
        .returning();

      if (!activity) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      EventBus.emit(
        createEvent({
          type: "crm.activity.logged",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { activityId: activity.id, dealId: input.dealId },
        }),
      );

      return activity;
    }),
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

const analyticsSubRouter = router({
  pipeline: protectedProcedure
    .input(
      z.object({
        period: z.enum(["30d", "90d", "365d"]).default("90d"),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const periodDays = input.period === "30d" ? 30 : input.period === "90d" ? 90 : 365;
      const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      const allDeals = await ctx.db.select().from(deals).where(eq(deals.tenantId, ctx.tenantId));

      // Stage breakdown
      const stageBreakdown = allDeals.reduce<Record<string, { count: number; value: number }>>(
        (acc, deal) => {
          const s = deal.stage;
          if (!acc[s]) acc[s] = { count: 0, value: 0 };
          acc[s]!.count += 1;
          acc[s]!.value += Number(deal.value ?? 0);
          return acc;
        },
        {},
      );

      // Win/loss rates
      const wonDeals = allDeals.filter((d) => d.stage === "won");
      const lostDeals = allDeals.filter((d) => d.stage === "lost");
      const closedCount = wonDeals.length + lostDeals.length;
      const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;

      // Total pipeline (active deals — not won/lost)
      const activeDeals = allDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");
      const totalPipeline = activeDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
      const avgDealSize =
        allDeals.length > 0
          ? allDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0) / allDeals.length
          : 0;

      // Deals created per month (last 6 months)
      const monthlyData: Record<string, { created: number; won: number; value: number }> = {};
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      allDeals
        .filter((d) => new Date(d.createdAt) >= sixMonthsAgo)
        .forEach((deal) => {
          const month = new Date(deal.createdAt).toISOString().slice(0, 7); // YYYY-MM
          if (!monthlyData[month]) monthlyData[month] = { created: 0, won: 0, value: 0 };
          monthlyData[month]!.created += 1;
          if (deal.stage === "won") {
            monthlyData[month]!.won += 1;
            monthlyData[month]!.value += Number(deal.value ?? 0);
          }
        });

      // Top companies by deal value
      const companyTotals: Record<string, { companyId: string; value: number; dealCount: number }> =
        {};
      allDeals
        .filter((d) => d.companyId)
        .forEach((deal) => {
          const cid = deal.companyId!;
          if (!companyTotals[cid]) companyTotals[cid] = { companyId: cid, value: 0, dealCount: 0 };
          companyTotals[cid]!.value += Number(deal.value ?? 0);
          companyTotals[cid]!.dealCount += 1;
        });
      const topCompanyIds = Object.values(companyTotals)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map((c) => c.companyId);

      let topCompanies: Array<{
        id: string;
        name: string;
        totalValue: number;
        dealCount: number;
      }> = [];
      if (topCompanyIds.length > 0) {
        const companyRows = await ctx.db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(and(eq(companies.tenantId, ctx.tenantId), inArray(companies.id, topCompanyIds)));
        topCompanies = companyRows
          .map((c) => ({
            id: c.id,
            name: c.name,
            totalValue: companyTotals[c.id]?.value ?? 0,
            dealCount: companyTotals[c.id]?.dealCount ?? 0,
          }))
          .sort((a, b) => b.totalValue - a.totalValue);
      }

      return {
        totalPipeline,
        avgDealSize,
        winRate,
        totalDeals: allDeals.length,
        wonThisPeriod: allDeals.filter(
          (d) => d.stage === "won" && new Date(d.updatedAt) >= since,
        ).length,
        stageBreakdown: Object.entries(stageBreakdown).map(([stage, data]) => ({
          stage,
          ...data,
        })),
        monthlyData: Object.entries(monthlyData)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({ month, ...data })),
        topCompanies,
      };
    }),
});

// ---------------------------------------------------------------------------
// Saved Views
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

const trashSubRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [deletedContacts, deletedCompanies, deletedDeals] = await Promise.all([
      ctx.db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.tenantId, ctx.tenantId),
            isNotNull(contacts.deletedAt),
            gt(contacts.deletedAt, cutoff),
          ),
        ),
      ctx.db
        .select()
        .from(companies)
        .where(
          and(
            eq(companies.tenantId, ctx.tenantId),
            isNotNull(companies.deletedAt),
            gt(companies.deletedAt, cutoff),
          ),
        ),
      ctx.db
        .select()
        .from(deals)
        .where(
          and(
            eq(deals.tenantId, ctx.tenantId),
            isNotNull(deals.deletedAt),
            gt(deals.deletedAt, cutoff),
          ),
        ),
    ]);

    return {
      contacts: deletedContacts,
      companies: deletedCompanies,
      deals: deletedDeals,
    };
  }),

  restore: memberProcedure
    .input(
      z.object({
        entity: z.enum(["contact", "company", "deal"]),
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.entity === "contact") {
        await ctx.db
          .update(contacts)
          .set({ deletedAt: null })
          .where(and(eq(contacts.id, input.id), eq(contacts.tenantId, ctx.tenantId)));
      } else if (input.entity === "company") {
        await ctx.db
          .update(companies)
          .set({ deletedAt: null })
          .where(and(eq(companies.id, input.id), eq(companies.tenantId, ctx.tenantId)));
      } else {
        await ctx.db
          .update(deals)
          .set({ deletedAt: null })
          .where(and(eq(deals.id, input.id), eq(deals.tenantId, ctx.tenantId)));
      }

      if (input.entity === "contact") {
        EventBus.emit(
          createEvent({
            type: "crm.contact.restored",
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            payload: { id: input.id },
          }),
        );
      } else if (input.entity === "company") {
        EventBus.emit(
          createEvent({
            type: "crm.company.restored",
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            payload: { id: input.id },
          }),
        );
      } else {
        EventBus.emit(
          createEvent({
            type: "crm.deal.restored",
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            payload: { id: input.id },
          }),
        );
      }

      return { id: input.id };
    }),

  purge: adminProcedure
    .input(
      z.object({
        entity: z.enum(["contact", "company", "deal"]),
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.entity === "contact") {
        await ctx.db
          .delete(contacts)
          .where(and(eq(contacts.id, input.id), eq(contacts.tenantId, ctx.tenantId)));
      } else if (input.entity === "company") {
        await ctx.db
          .delete(companies)
          .where(and(eq(companies.id, input.id), eq(companies.tenantId, ctx.tenantId)));
      } else {
        await ctx.db
          .delete(deals)
          .where(and(eq(deals.id, input.id), eq(deals.tenantId, ctx.tenantId)));
      }

      return { id: input.id };
    }),
});

// ---------------------------------------------------------------------------
// Pipeline Stages
// ---------------------------------------------------------------------------

const pipelineStagesSubRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return ctx.db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.tenantId, ctx.tenantId))
      .orderBy(pipelineStages.position);
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().default("bg-stone-400"),
        position: z.number().int().default(0),
        isWon: z.boolean().default(false),
        isLost: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [stage] = await ctx.db
        .insert(pipelineStages)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      if (!stage) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return stage;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        color: z.string().optional(),
        isWon: z.boolean().optional(),
        isLost: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [updated] = await ctx.db
        .update(pipelineStages)
        .set(fields)
        .where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, ctx.tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  reorder: adminProcedure
    .input(z.array(z.object({ id: z.string().uuid(), position: z.number().int() })))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.map(({ id, position }) =>
          ctx.db
            .update(pipelineStages)
            .set({ position })
            .where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, ctx.tenantId))),
        ),
      );
      return { ok: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(pipelineStages)
        .where(and(eq(pipelineStages.id, input.id), eq(pipelineStages.tenantId, ctx.tenantId)));
      return { id: input.id };
    }),
});

// ---------------------------------------------------------------------------
// Saved Views
// ---------------------------------------------------------------------------

const savedViewsSubRouter = router({
  list: protectedProcedure
    .input(z.object({ entity: z.enum(["contacts", "companies", "deals"]) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return ctx.db
        .select()
        .from(crmSavedViews)
        .where(
          and(
            eq(crmSavedViews.tenantId, ctx.tenantId),
            eq(crmSavedViews.userId, ctx.userId),
            eq(crmSavedViews.entity, input.entity),
          ),
        )
        .orderBy(crmSavedViews.createdAt);
    }),

  create: memberProcedure
    .input(
      z.object({
        entity: z.enum(["contacts", "companies", "deals"]),
        name: z.string().min(1).max(100),
        filters: z.record(z.unknown()).default({}),
        sort: z.record(z.unknown()).default({}),
        columnVisibility: z.record(z.unknown()).default({}),
        isDefault: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [view] = await ctx.db
        .insert(crmSavedViews)
        .values({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          ...input,
        })
        .returning();
      if (!view) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return view;
    }),

  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        filters: z.record(z.unknown()).optional(),
        sort: z.record(z.unknown()).optional(),
        columnVisibility: z.record(z.unknown()).optional(),
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [updated] = await ctx.db
        .update(crmSavedViews)
        .set(fields)
        .where(
          and(
            eq(crmSavedViews.id, id),
            eq(crmSavedViews.tenantId, ctx.tenantId),
            eq(crmSavedViews.userId, ctx.userId),
          ),
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(crmSavedViews)
        .where(
          and(
            eq(crmSavedViews.id, input.id),
            eq(crmSavedViews.tenantId, ctx.tenantId),
            eq(crmSavedViews.userId, ctx.userId),
          ),
        );
      return { id: input.id };
    }),

  setDefault: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        entity: z.enum(["contacts", "companies", "deals"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Clear existing defaults for this entity+user
      await ctx.db
        .update(crmSavedViews)
        .set({ isDefault: false })
        .where(
          and(
            eq(crmSavedViews.tenantId, ctx.tenantId),
            eq(crmSavedViews.userId, ctx.userId),
            eq(crmSavedViews.entity, input.entity),
          ),
        );
      // Set new default
      const [updated] = await ctx.db
        .update(crmSavedViews)
        .set({ isDefault: true })
        .where(
          and(
            eq(crmSavedViews.id, input.id),
            eq(crmSavedViews.tenantId, ctx.tenantId),
          ),
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),
});

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

const auditLogSubRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        entity: z.enum(["contact", "company", "deal"]),
        recordId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return ctx.db
        .select()
        .from(crmAuditLog)
        .where(
          and(
            eq(crmAuditLog.tenantId, ctx.tenantId),
            eq(crmAuditLog.entity, input.entity),
            eq(crmAuditLog.recordId, input.recordId),
          ),
        )
        .orderBy(desc(crmAuditLog.changedAt))
        .limit(100);
    }),
});

// ---------------------------------------------------------------------------
// Notes (one rich-text note per entity+record, upserted on save)
// ---------------------------------------------------------------------------

const notesSubRouter = router({
  get: protectedProcedure
    .input(
      z.object({
        entity: z.enum(["contact", "company", "deal"]),
        recordId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const [note] = await ctx.db
        .select()
        .from(crmNotes)
        .where(
          and(
            eq(crmNotes.tenantId, ctx.tenantId),
            eq(crmNotes.entity, input.entity),
            eq(crmNotes.recordId, input.recordId),
          ),
        );
      return note ?? null;
    }),

  upsert: memberProcedure
    .input(
      z.object({
        entity: z.enum(["contact", "company", "deal"]),
        recordId: z.string().uuid(),
        content: z.array(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: crmNotes.id })
        .from(crmNotes)
        .where(
          and(
            eq(crmNotes.tenantId, ctx.tenantId),
            eq(crmNotes.entity, input.entity),
            eq(crmNotes.recordId, input.recordId),
          ),
        );

      if (existing.length > 0 && existing[0]) {
        const [updated] = await ctx.db
          .update(crmNotes)
          .set({ content: input.content, updatedAt: new Date(), updatedBy: ctx.userId })
          .where(eq(crmNotes.id, existing[0].id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(crmNotes)
        .values({
          tenantId: ctx.tenantId,
          entity: input.entity,
          recordId: input.recordId,
          content: input.content,
          updatedBy: ctx.userId,
        })
        .returning();
      return created;
    }),
});

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

const favoritesSubRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return ctx.db
      .select()
      .from(crmFavorites)
      .where(
        and(
          eq(crmFavorites.tenantId, ctx.tenantId),
          eq(crmFavorites.userId, ctx.userId),
        ),
      )
      .orderBy(desc(crmFavorites.createdAt));
  }),

  toggle: memberProcedure
    .input(
      z.object({
        entity: z.enum(["contact", "company", "deal"]),
        recordId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: crmFavorites.id })
        .from(crmFavorites)
        .where(
          and(
            eq(crmFavorites.tenantId, ctx.tenantId),
            eq(crmFavorites.userId, ctx.userId),
            eq(crmFavorites.entity, input.entity),
            eq(crmFavorites.recordId, input.recordId),
          ),
        );

      if (existing.length > 0 && existing[0]) {
        await ctx.db
          .delete(crmFavorites)
          .where(eq(crmFavorites.id, existing[0].id));
        return { favorited: false };
      }

      await ctx.db.insert(crmFavorites).values({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        entity: input.entity,
        recordId: input.recordId,
      });
      return { favorited: true };
    }),
});

// ---------------------------------------------------------------------------
// Full-text search helper
// ---------------------------------------------------------------------------

function buildTsQuery(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word}:*`)
    .join(" & ");
}

const searchSubRouter = router({
  query: protectedProcedure
    .input(
      z.object({
        q: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const tsQuery = buildTsQuery(input.q);

      const [matchingContacts, matchingCompanies, matchingDeals] = await Promise.all([
        ctx.db
          .select({
            id: contacts.id,
            name: contacts.name,
            email: contacts.email,
          })
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, ctx.tenantId),
              sql`search_vector @@ to_tsquery('english', ${tsQuery})`,
            ),
          )
          .limit(input.limit),

        ctx.db
          .select({
            id: companies.id,
            name: companies.name,
            domain: companies.domain,
          })
          .from(companies)
          .where(
            and(
              eq(companies.tenantId, ctx.tenantId),
              sql`search_vector @@ to_tsquery('english', ${tsQuery})`,
            ),
          )
          .limit(input.limit),

        ctx.db
          .select({
            id: deals.id,
            title: deals.title,
            stage: deals.stage,
            value: deals.value,
          })
          .from(deals)
          .where(
            and(
              eq(deals.tenantId, ctx.tenantId),
              sql`search_vector @@ to_tsquery('english', ${tsQuery})`,
            ),
          )
          .limit(input.limit),
      ]);

      return {
        contacts: matchingContacts.map((r) => ({ ...r, type: "contact" as const })),
        companies: matchingCompanies.map((r) => ({ ...r, type: "company" as const })),
        deals: matchingDeals.map((r) => ({ ...r, type: "deal" as const })),
      };
    }),
});

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

const remindersSubRouter = router({
  create: memberProcedure
    .input(
      z.object({
        entity: z.enum(["contact", "company", "deal"]),
        recordId: z.string().uuid(),
        remindAt: z.string().datetime(),
        message: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const delay = new Date(input.remindAt).getTime() - Date.now();
      if (delay < 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Reminder time must be in the future" });
      }

      EventBus.emit(
        createEvent({
          type: "crm.reminder.set",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: {
            entity: input.entity,
            recordId: input.recordId,
            remindAt: input.remindAt,
            message: input.message,
          },
        }),
      );

      return { scheduled: true, remindAt: input.remindAt };
    }),
});

// ---------------------------------------------------------------------------
// Custom field defs enums
// ---------------------------------------------------------------------------

const ENTITY_ENUM = z.enum(["contacts", "companies", "deals"]);
const FIELD_TYPE_ENUM = z.enum(["text", "number", "date", "boolean", "select", "multi_select", "url", "phone"]);

const customFieldDefsSubRouter = router({
  list: protectedProcedure
    .input(z.object({ entity: ENTITY_ENUM }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return ctx.db
        .select()
        .from(customFieldDefs)
        .where(
          and(
            eq(customFieldDefs.tenantId, ctx.tenantId),
            eq(customFieldDefs.entity, input.entity),
          ),
        )
        .orderBy(customFieldDefs.position);
    }),

  create: adminProcedure
    .input(
      z.object({
        entity: ENTITY_ENUM,
        key: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z_]+$/),
        label: z.string().min(1).max(100),
        type: FIELD_TYPE_ENUM,
        options: z.array(z.string()).optional(),
        required: z.boolean().default(false),
        position: z.number().int().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [def] = await ctx.db
        .insert(customFieldDefs)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      if (!def) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return def;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).max(100).optional(),
        options: z.array(z.string()).optional(),
        required: z.boolean().optional(),
        position: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [updated] = await ctx.db
        .update(customFieldDefs)
        .set(fields)
        .where(
          and(eq(customFieldDefs.id, id), eq(customFieldDefs.tenantId, ctx.tenantId)),
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(customFieldDefs)
        .where(
          and(eq(customFieldDefs.id, input.id), eq(customFieldDefs.tenantId, ctx.tenantId)),
        );
      return { id: input.id };
    }),
});

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

async function generatePresignedPutUrl(storageKey: string, mimeType: string): Promise<string> {
  // Stub: replace with real S3/R2 presigned URL generation in production
  const baseUrl = process.env["STORAGE_BASE_URL"] ?? "https://storage.example.com";
  return `${baseUrl}/${storageKey}?content-type=${encodeURIComponent(mimeType)}`;
}

const attachmentsSubRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        entity: ENTITY_ENUM,
        recordId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return ctx.db
        .select()
        .from(crmAttachments)
        .where(
          and(
            eq(crmAttachments.tenantId, ctx.tenantId),
            eq(crmAttachments.entity, input.entity),
            eq(crmAttachments.recordId, input.recordId),
          ),
        )
        .orderBy(desc(crmAttachments.createdAt));
    }),

  getUploadUrl: memberProcedure
    .input(
      z.object({
        entity: ENTITY_ENUM,
        recordId: z.string().uuid(),
        filename: z.string().min(1).max(255),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storageKey = `crm/${ctx.tenantId}/${input.entity}/${input.recordId}/${Date.now()}-${input.filename}`;
      const uploadUrl = await generatePresignedPutUrl(storageKey, input.mimeType);
      return { uploadUrl, storageKey };
    }),

  confirmUpload: memberProcedure
    .input(
      z.object({
        entity: ENTITY_ENUM,
        recordId: z.string().uuid(),
        filename: z.string().min(1).max(255),
        storageKey: z.string().min(1),
        sizeBytes: z.number().int().positive(),
        mimeType: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [attachment] = await ctx.db
        .insert(crmAttachments)
        .values({
          tenantId: ctx.tenantId,
          entity: input.entity,
          recordId: input.recordId,
          filename: input.filename,
          storageKey: input.storageKey,
          sizeBytes: input.sizeBytes,
          mimeType: input.mimeType,
          uploadedBy: ctx.userId,
        })
        .returning();
      if (!attachment) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return attachment;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(crmAttachments)
        .where(and(eq(crmAttachments.id, input.id), eq(crmAttachments.tenantId, ctx.tenantId)));
      return { id: input.id };
    }),
});

// ---------------------------------------------------------------------------
// CRM root router
// ---------------------------------------------------------------------------

export const crmRouter = router({
  contacts: contactsSubRouter,
  companies: companiesSubRouter,
  deals: dealsSubRouter,
  activities: activitiesSubRouter,
  trash: trashSubRouter,
  pipelineStages: pipelineStagesSubRouter,
  savedViews: savedViewsSubRouter,
  auditLog: auditLogSubRouter,
  notes: notesSubRouter,
  favorites: favoritesSubRouter,
  search: searchSubRouter,
  reminders: remindersSubRouter,
  customFieldDefs: customFieldDefsSubRouter,
  attachments: attachmentsSubRouter,
  analytics: analyticsSubRouter,
});
