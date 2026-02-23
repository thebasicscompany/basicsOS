import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, or } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure } from "../trpc.js";
import { contacts, companies, deals, dealActivities, crmSavedViews } from "@basicsos/db";
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
// CRM root router
// ---------------------------------------------------------------------------

export const crmRouter = router({
  contacts: contactsSubRouter,
  companies: companiesSubRouter,
  deals: dealsSubRouter,
  activities: activitiesSubRouter,
  savedViews: savedViewsSubRouter,
});
