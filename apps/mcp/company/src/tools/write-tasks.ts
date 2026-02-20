import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createSystemCaller, getMcpWriteContext } from "../caller.js";

export const registerWriteTasksTools = (server: McpServer): void => {
  // ── Create task ────────────────────────────────────────────────────────────
  server.tool(
    "create_task",
    "Create a new task for the company",
    {
      title: z.string().min(1).max(512).describe("Task title"),
      description: z.string().optional().describe("Optional task description"),
      priority: z
        .enum(["low", "medium", "high", "urgent"])
        .default("medium")
        .describe("Task priority"),
    },
    { readOnlyHint: false, idempotentHint: false },
    async ({ title, description, priority }) => {
      const result = getMcpWriteContext();
      if (!result.ok) {
        return { content: [{ type: "text" as const, text: `Error: ${result.error}` }] };
      }
      const { tenantId, userId } = result.ctx;
      try {
        const caller = createSystemCaller(tenantId, userId);
        const task = await caller.tasks.create({ title, description, priority });
        return {
          content: [
            {
              type: "text" as const,
              text: `Created task "${task.title}" (ID: ${task.id}, priority: ${task.priority})`,
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
      }
    },
  );

  // ── Update task status ─────────────────────────────────────────────────────
  server.tool(
    "update_task_status",
    "Update the status of an existing task. Use list_tasks first to find the task ID.",
    {
      id: z.string().uuid().describe("Task ID"),
      status: z.enum(["todo", "in-progress", "done"]).describe("New status"),
    },
    { readOnlyHint: false, idempotentHint: true },
    async ({ id, status }) => {
      const result = getMcpWriteContext();
      if (!result.ok) {
        return { content: [{ type: "text" as const, text: `Error: ${result.error}` }] };
      }
      const { tenantId, userId } = result.ctx;
      try {
        const caller = createSystemCaller(tenantId, userId);
        const task = await caller.tasks.update({ id, status });
        return {
          content: [
            {
              type: "text" as const,
              text: `Updated task "${task.title}" → ${task.status}`,
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
