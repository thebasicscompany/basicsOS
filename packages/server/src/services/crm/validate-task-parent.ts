import { and, count, eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";

/**
 * One level of nesting: only top-level tasks may have children.
 * A task that already has subtasks cannot become a subtask.
 */
export async function validateTaskParentAssignment(
  db: Db,
  organizationId: string,
  parentTaskId: number | null,
  options?: { taskId?: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (parentTaskId == null) return { ok: true };

  if (options?.taskId != null && parentTaskId === options.taskId) {
    return { ok: false, error: "A task cannot be its own parent" };
  }

  const [parent] = await db
    .select({
      id: schema.tasks.id,
      organizationId: schema.tasks.organizationId,
      parentTaskId: schema.tasks.parentTaskId,
    })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.id, parentTaskId),
        eq(schema.tasks.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!parent) {
    return { ok: false, error: "Parent task not found" };
  }
  if (parent.parentTaskId != null) {
    return {
      ok: false,
      error:
        "Subtasks cannot have their own subtasks — choose a top-level task as the parent",
    };
  }

  if (options?.taskId != null) {
    const [childRow] = await db
      .select({ c: count() })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.organizationId, organizationId),
          eq(schema.tasks.parentTaskId, options.taskId),
        ),
      );
    if (Number(childRow?.c ?? 0) > 0) {
      return {
        ok: false,
        error:
          "This task has subtasks — remove or reassign them before making it a subtask",
      };
    }
  }

  return { ok: true };
}
