import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createSystemCaller, getMcpWriteContext } from "../caller.js";

export const registerWriteCrmTools = (server: McpServer): void => {
  // ── Add CRM contact ────────────────────────────────────────────────────────
  server.tool(
    "add_crm_contact",
    "Add a new contact to the company CRM",
    {
      name: z.string().min(1).max(255).describe("Full name"),
      email: z.string().email().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
    },
    { readOnlyHint: false, idempotentHint: false },
    async ({ name, email, phone }) => {
      const result = getMcpWriteContext();
      if (!result.ok) {
        return { content: [{ type: "text" as const, text: `Error: ${result.error}` }] };
      }
      const { tenantId, userId } = result.ctx;
      try {
        const caller = createSystemCaller(tenantId, userId);
        const contact = await caller.crm.contacts.create({ name, email, phone });
        return {
          content: [{
            type: "text" as const,
            text: `Added contact "${contact.name}"${contact.email ? ` <${contact.email}>` : ""} (ID: ${contact.id})`,
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
      }
    },
  );
};
