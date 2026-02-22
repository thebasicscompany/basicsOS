import { z } from "zod";
import { eq } from "drizzle-orm";
import { tasks, users } from "@basicsos/db";
import type { ActionHandler } from "./index.js";

const configSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.string().datetime().optional(), // ISO 8601 string
});

/** Resolve a fallback createdBy: first admin, then any user in the tenant. */
const resolveFallbackUser = async (
  db: Parameters<ActionHandler>[1]["db"],
  tenantId: string,
): Promise<string | null> => {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .limit(1);
  return admin?.id ?? null;
};

export const createTaskAction: ActionHandler = async (config, ctx) => {
  const { title, description, assigneeId, priority, dueDate } = configSchema.parse(config);

  // Resolve the creator: event user → first tenant user → fail gracefully
  const createdBy =
    ctx.triggerUserId ?? (await resolveFallbackUser(ctx.db, ctx.tenantId));

  if (!createdBy) {
    return { status: "failed", output: null, error: "No user found in tenant to assign as task creator" };
  }

  const [task] = await ctx.db
    .insert(tasks)
    .values({
      tenantId: ctx.tenantId,
      title,
      description,
      assigneeId,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      sourceType: "automation",
      createdBy,
    })
    .returning({ id: tasks.id, title: tasks.title });

  if (!task) return { status: "failed", output: null, error: "Task insert returned no row" };

  return { status: "success", output: { taskId: task.id, title: task.title } };
};
