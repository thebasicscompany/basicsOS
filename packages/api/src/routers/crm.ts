import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, isNull, isNotNull, gt } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure, adminProcedure } from "../trpc.js";
import { contacts, companies, deals, dealActivities, pipelineStages, crmSavedViews, crmAuditLog, crmNotes } from "@basicsos/db";
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
/ Trash
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
// Notes
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
});
