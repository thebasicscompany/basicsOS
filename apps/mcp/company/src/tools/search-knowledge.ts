import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createSystemCaller } from "../caller.js";

export const registerSearchKnowledgeTool = (server: McpServer): void => {
  server.tool(
    "search_knowledge_base",
    "Search the company knowledge base for documents",
    { query: z.string().describe("Search query") },
    async ({ query }) => {
      const tenantId = process.env["MCP_TENANT_ID"] ?? "";
      if (!tenantId) {
        return {
          content: [{ type: "text" as const, text: "Error: MCP_TENANT_ID not configured" }],
        };
      }
      try {
        const caller = createSystemCaller(tenantId);
        const results = await caller.knowledge.search({ query });
        const text =
          results.length === 0
            ? "No documents found."
            : results.map((d) => `**${d.title}**\nID: ${d.id}`).join("\n\n");
        return { content: [{ type: "text" as const, text }] };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
      }
    },
  );
};
