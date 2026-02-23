import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
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
                or(
                  ilike(contacts.name, `%${search.replace(/[%_\\]/g, "\\$&")}%`),
                  ilike(contacts.email, `%${search.replace(/[%_\\]/g, "\\$&")}%`),
                ),
              )
            : eq(contacts.tenantId, ctx.tenantId),
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
});

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

const companiesSubRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });

    return ctx.db.select().from(companies).where(eq(companies.tenantId, ctx.tenantId));
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
// CRM root router
// ---------------------------------------------------------------------------

export const crmRouter = router({
  contacts: contactsSubRouter,
  companies: companiesSubRouter,
  deals: dealsSubRouter,
  activities: activitiesSubRouter,
  analytics: analyticsSubRouter,
});
