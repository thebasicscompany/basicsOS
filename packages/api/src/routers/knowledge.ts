import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { router, protectedProcedure, memberProcedure } from "../trpc.js";
import { documents } from "@basicsos/db";
import {
  createKnowledgeDocumentSchema,
  updateKnowledgeDocumentSchema,
  reorderKnowledgeDocumentsSchema,
} from "@basicsos/shared";
import { EventBus, createEvent } from "../events/bus.js";

export const knowledgeRouter = router({
  list: protectedProcedure
    .input(z.object({ parentId: z.string().uuid().nullable().default(null) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
      }
      const filter =
        input.parentId === null
          ? and(eq(documents.tenantId, ctx.tenantId), isNull(documents.parentId))
          : and(
              eq(documents.tenantId, ctx.tenantId),
              eq(documents.parentId, input.parentId),
            );

      return ctx.db
        .select({
          id: documents.id,
          title: documents.title,
          parentId: documents.parentId,
          position: documents.position,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(filter);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
      }
      const [doc] = await ctx.db
        .select()
        .from(documents)
        .where(and(eq(documents.id, input.id), eq(documents.tenantId, ctx.tenantId)));

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }
      return doc;
    }),

  create: memberProcedure
    .input(createKnowledgeDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.db
        .insert(documents)
        .values({
          tenantId: ctx.tenantId,
          title: input.title,
          parentId: input.parentId ?? null,
          position: input.position,
          createdBy: ctx.userId,
        })
        .returning();

      if (!doc) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      EventBus.emit(
        createEvent({
          type: "document.created",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { documentId: doc.id },
        }),
      );

      return doc;
    }),

  update: memberProcedure
    .input(updateKnowledgeDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, title, contentJson, position } = input;

      const [existing] = await ctx.db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.tenantId, ctx.tenantId)));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      type DocUpdate = {
        title?: string;
        contentJson?: Record<string, unknown>;
        position?: number;
        updatedBy: string;
        updatedAt: Date;
      };

      const updates: DocUpdate = {
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      };
      if (title !== undefined) updates.title = title;
      if (contentJson !== undefined) updates.contentJson = contentJson;
      if (position !== undefined) updates.position = position;

      const [doc] = await ctx.db
        .update(documents)
        .set(updates)
        .where(and(eq(documents.id, id), eq(documents.tenantId, ctx.tenantId)))
        .returning();

      if (!doc) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      EventBus.emit(
        createEvent({
          type: "document.updated",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { documentId: doc.id },
        }),
      );

      return doc;
    }),

  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.id, input.id), eq(documents.tenantId, ctx.tenantId)));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      await ctx.db
        .delete(documents)
        .where(and(eq(documents.id, input.id), eq(documents.tenantId, ctx.tenantId)));

      EventBus.emit(
        createEvent({
          type: "document.updated",
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload: { documentId: input.id },
        }),
      );

      return { id: input.id };
    }),

  reorder: memberProcedure
    .input(reorderKnowledgeDocumentsSchema)
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.updates.map((update: { id: string; position: number }) =>
          ctx.db
            .update(documents)
            .set({ position: update.position, updatedAt: new Date() })
            .where(
              and(eq(documents.id, update.id), eq(documents.tenantId, ctx.tenantId)),
            ),
        ),
      );
      // Emit update event for each reordered document
      for (const update of input.updates) {
        EventBus.emit(
          createEvent({
            type: "document.updated",
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            payload: { documentId: update.id },
          }),
        );
      }

      return { updated: input.updates.length };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
      }
      return ctx.db
        .select({
          id: documents.id,
          title: documents.title,
          parentId: documents.parentId,
          position: documents.position,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(
          and(
            eq(documents.tenantId, ctx.tenantId),
            sql`${documents.title} ilike ${"%" + input.query + "%"}`,
          ),
        );
    }),
});
