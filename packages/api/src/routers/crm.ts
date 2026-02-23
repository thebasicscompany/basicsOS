import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, or, isNull, sql } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure } from "../trpc.js";
import { contacts, companies, deals, dealActivities } from "@basicsos/db";
import { EventBus, createEvent } from "../events/bus.js";

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
        .where(and(eq(contacts.id, input.id), eq(contacts.tenantId, ctx.tenantId)));

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

      const [updated] = await ctx.db
        .update(contacts)
        .set({
          ...fields,
          updatedAt: new Date(),
        })
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(contacts)
        .where(and(eq(contacts.id, input.id), eq(contacts.tenantId, ctx.tenantId)))
        .returning({ id: contacts.id });

      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: deleted.id };
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
        .where(and(eq(companies.id, input.id), eq(companies.tenantId, ctx.tenantId)));

      if (!company) throw new TRPCError({ code: "NOT_FOUND" });

      const linkedContacts = await ctx.db
        .select()
        .from(contacts)
        .where(and(eq(contacts.companyId, input.id), eq(contacts.tenantId, ctx.tenantId)));

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

      const [updated] = await ctx.db
        .update(companies)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(companies.id, id), eq(companies.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(companies)
        .where(and(eq(companies.id, input.id), eq(companies.tenantId, ctx.tenantId)))
        .returning({ id: companies.id });

      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: deleted.id };
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
});

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

const dealsSubRouter = router({
  listByStage: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });

    const rows = await ctx.db.select().from(deals).where(eq(deals.tenantId, ctx.tenantId));

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
        .where(and(eq(deals.id, input.id), eq(deals.tenantId, ctx.tenantId)));

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

      const [updated] = await ctx.db
        .update(deals)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(deals)
        .where(and(eq(deals.id, input.id), eq(deals.tenantId, ctx.tenantId)))
        .returning({ id: deals.id });

      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: deleted.id };
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
// CRM root router
// ---------------------------------------------------------------------------

export const crmRouter = router({
  contacts: contactsSubRouter,
  companies: companiesSubRouter,
  deals: dealsSubRouter,
  activities: activitiesSubRouter,
});
