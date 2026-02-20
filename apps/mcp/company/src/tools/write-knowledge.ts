import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createSystemCaller, getMcpWriteContext } from "../caller.js";

// In-memory store for pending delete confirmations.
// TTL of 5 minutes — short-lived MCP sessions don't need persistence.
type PendingDelete = { documentId: string; tenantId: string; title: string; expiresAt: number };
const pendingDeletes = new Map<string, PendingDelete>();

const pruneExpired = (): void => {
  const now = Date.now();
  for (const [token, entry] of pendingDeletes) {
    if (entry.expiresAt < now) pendingDeletes.delete(token);
  }
};

// Converts plain text (newline-separated) into a minimal TipTap/ProseMirror doc.
const textToTiptap = (text: string): Record<string, unknown> => ({
  type: "doc",
  content: text.split("\n").map((line) => ({
    type: "paragraph",
    content: line.trim() ? [{ type: "text", text: line }] : [],
  })),
});

export const registerWriteKnowledgeTools = (server: McpServer): void => {
  // ── Create document ────────────────────────────────────────────────────────
  server.tool(
    "create_document",
    "Create a new document in the company knowledge base",
    {
      title: z.string().min(1).max(512).describe("Document title"),
      content: z.string().optional().describe("Document body as plain text"),
    },
    { readOnlyHint: false, idempotentHint: false },
    async ({ title, content }) => {
      const result = getMcpWriteContext();
      if (!result.ok) {
        return { content: [{ type: "text" as const, text: `Error: ${result.error}` }] };
      }
      const { tenantId, userId } = result.ctx;
      try {
        const caller = createSystemCaller(tenantId, userId);
        const doc = await caller.knowledge.create({ title });

        if (content) {
          await caller.knowledge.update({
            id: doc.id,
            contentJson: textToTiptap(content),
          });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Created document "${title}" (ID: ${doc.id})`,
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
      }
    },
  );

  // ── Update document content ────────────────────────────────────────────────
  server.tool(
    "update_document",
    "Update the title or content of an existing knowledge base document. Use search_knowledge_base first to find the document ID.",
    {
      id: z.string().uuid().describe("Document ID"),
      title: z.string().min(1).max(512).optional().describe("New title (omit to keep existing)"),
      content: z.string().optional().describe("New body as plain text (omit to keep existing)"),
    },
    { readOnlyHint: false, idempotentHint: true },
    async ({ id, title, content }) => {
      const result = getMcpWriteContext();
      if (!result.ok) {
        return { content: [{ type: "text" as const, text: `Error: ${result.error}` }] };
      }
      const { tenantId, userId } = result.ctx;
      try {
        const caller = createSystemCaller(tenantId, userId);
        await caller.knowledge.update({
          id,
          ...(title !== undefined && { title }),
          ...(content !== undefined && { contentJson: textToTiptap(content) }),
        });
        return { content: [{ type: "text" as const, text: `Updated document ${id}` }] };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
      }
    },
  );

  // ── Delete document — step 1: preview ─────────────────────────────────────
  server.tool(
    "delete_document_preview",
    "Preview a document deletion and get a confirmation token. You MUST call delete_document_confirm with the token to actually delete it.",
    {
      id: z.string().uuid().describe("Document ID to delete"),
    },
    { readOnlyHint: true },
    async ({ id }) => {
      const tenantId = process.env["MCP_TENANT_ID"] ?? "";
      if (!tenantId) {
        return {
          content: [{ type: "text" as const, text: "Error: MCP_TENANT_ID not configured" }],
        };
      }
      try {
        pruneExpired();
        const caller = createSystemCaller(tenantId);
        const doc = await caller.knowledge.get({ id });

        const token = crypto.randomUUID();
        pendingDeletes.set(token, {
          documentId: id,
          tenantId,
          title: doc.title,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `About to delete: "${doc.title}" (ID: ${id})`,
                `Confirmation token: ${token}`,
                `Token expires in 5 minutes.`,
                `Call delete_document_confirm with this token to proceed.`,
              ].join("\n"),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
      }
    },
  );

  // ── Delete document — step 2: confirm ─────────────────────────────────────
  server.tool(
    "delete_document_confirm",
    "Permanently delete a document using the confirmation token from delete_document_preview. This cannot be undone.",
    {
      token: z.string().uuid().describe("Confirmation token from delete_document_preview"),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    async ({ token }) => {
      pruneExpired();
      const pending = pendingDeletes.get(token);
      if (!pending) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Invalid or expired confirmation token. Call delete_document_preview again.",
            },
          ],
        };
      }

      pendingDeletes.delete(token);

      try {
        const caller = createSystemCaller(pending.tenantId);
        await caller.knowledge.delete({ id: pending.documentId });
        return {
          content: [
            {
              type: "text" as const,
              text: `Deleted document "${pending.title}" (ID: ${pending.documentId})`,
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
      }
    },
  );
};
