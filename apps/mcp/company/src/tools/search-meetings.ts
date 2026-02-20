import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createSystemCaller } from "../caller.js";

export const registerSearchMeetingsTool = (server: McpServer): void => {
  server.tool(
    "search_meetings",
    "Search meeting transcripts and summaries",
    { query: z.string().describe("Search query") },
    { readOnlyHint: true },
    async ({ query }) => {
      const tenantId = process.env["MCP_TENANT_ID"] ?? "";
      if (!tenantId) {
        return {
          content: [{ type: "text" as const, text: "Error: MCP_TENANT_ID not configured" }],
        };
      }
      try {
        const caller = createSystemCaller(tenantId);
        const meetings = await caller.meetings.search({ query });
        const text =
          meetings.length === 0
            ? "No meetings found."
            : meetings
                .map(
                  (m) =>
                    `- ${m.title} (started: ${m.startedAt instanceof Date ? m.startedAt.toISOString() : (m.startedAt ?? "unknown")}, ID: ${m.id})`,
                )
                .join("\n");
        return { content: [{ type: "text" as const, text }] };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
      }
    },
  );
};
