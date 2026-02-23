import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure } from "../trpc.js";
import { contacts, companies, deals, dealActivities, crmAttachments } from "@basicsos/db";
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
// Attachments
// ---------------------------------------------------------------------------

const ENTITY_ENUM = z.enum(["contact", "company", "deal"]);

async function generatePresignedPutUrl(storageKey: string, mimeType: string): Promise<string> {
  const s3Url = process.env["S3_ENDPOINT"] ?? process.env["AWS_S3_ENDPOINT"];
  const bucket = process.env["S3_BUCKET"] ?? process.env["AWS_S3_BUCKET"];

  if (!s3Url || !bucket) {
    return `/api/upload?key=${encodeURIComponent(storageKey)}`;
  }

  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const s3 = new S3Client({
      endpoint: s3Url,
      region: process.env["AWS_REGION"] ?? "us-east-1",
      credentials: {
        accessKeyId: process.env["AWS_ACCESS_KEY_ID"] ?? "",
        secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] ?? "",
      },
      forcePathStyle: true,
    });
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: mimeType });
    return await getSignedUrl(s3, cmd, { expiresIn: 300 });
  } catch {
    return `/api/upload?key=${encodeURIComponent(storageKey)}`;
  }
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
  attachments: attachmentsSubRouter,
});
