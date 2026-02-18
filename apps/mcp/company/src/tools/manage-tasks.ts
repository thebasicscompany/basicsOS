import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createSystemCaller } from "../caller.js";

export const registerManageTasksTool = (server: McpServer): void => {
  server.tool(
    "list_tasks",
    "List tasks for the company",
    {
      status: z
        .enum(["todo", "in-progress", "done"])
        .optional()
        .describe("Filter tasks by status"),
    },
    async ({ status }) => {
      const tenantId = process.env["MCP_TENANT_ID"] ?? "";
      if (!tenantId) {
        return {
          content: [{ type: "text" as const, text: "Error: MCP_TENANT_ID not configured" }],
        };
      }
      try {
        const caller = createSystemCaller(tenantId);
        const tasks = await caller.tasks.list({ status });
        const text =
          tasks.length === 0
            ? "No tasks found."
            : tasks
                .map(
                  (t) => `- [${t.status}] ${t.title} (priority: ${t.priority}, ID: ${t.id})`,
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
