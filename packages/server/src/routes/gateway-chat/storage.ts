import { and, eq, desc, inArray } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";

export async function ensureThread(
  db: Db,
  crmUser: typeof schema.crmUsers.$inferSelect,
  threadIdRaw?: string,
  channelRaw?: string,
): Promise<string> {
  if (!crmUser.organizationId) throw new Error("Organization not found");
  const channel =
    channelRaw === "voice" || channelRaw === "automation" ? channelRaw : "chat";

  if (threadIdRaw?.trim()) {
    const id = threadIdRaw.trim();
    const existing = await db
      .select({ id: schema.aiThreads.id })
      .from(schema.aiThreads)
      .where(
        and(
          eq(schema.aiThreads.id, id),
          eq(schema.aiThreads.crmUserId, crmUser.id),
        ),
      )
      .limit(1);
    if (existing[0]) return id;
  }

  const [inserted] = await db
    .insert(schema.aiThreads)
    .values({
      crmUserId: crmUser.id,
      organizationId: crmUser.organizationId,
      channel,
    })
    .returning({ id: schema.aiThreads.id });

  if (!inserted) throw new Error("Failed to create thread");
  return inserted.id;
}

export async function listThreads(
  db: Db,
  crmUserId: number,
  opts?: { limit?: number; channel?: string },
) {
  const conditions = [eq(schema.aiThreads.crmUserId, crmUserId)];
  if (opts?.channel) {
    conditions.push(eq(schema.aiThreads.channel, opts.channel));
  }
  return db
    .select({
      id: schema.aiThreads.id,
      title: schema.aiThreads.title,
      channel: schema.aiThreads.channel,
      createdAt: schema.aiThreads.createdAt,
      updatedAt: schema.aiThreads.updatedAt,
    })
    .from(schema.aiThreads)
    .where(and(...conditions))
    .orderBy(desc(schema.aiThreads.updatedAt))
    .limit(opts?.limit ?? 20);
}

export async function getThreadMessages(
  db: Db,
  threadId: string,
  crmUserId: number,
) {
  // Verify ownership
  const thread = await db
    .select({ id: schema.aiThreads.id })
    .from(schema.aiThreads)
    .where(
      and(
        eq(schema.aiThreads.id, threadId),
        eq(schema.aiThreads.crmUserId, crmUserId),
      ),
    )
    .limit(1);
  if (!thread[0]) return null;

  return db
    .select({
      id: schema.aiMessages.id,
      role: schema.aiMessages.role,
      content: schema.aiMessages.content,
      createdAt: schema.aiMessages.createdAt,
    })
    .from(schema.aiMessages)
    .where(
      and(
        eq(schema.aiMessages.threadId, threadId),
        inArray(schema.aiMessages.role, ["user", "assistant"]),
      ),
    )
    .orderBy(schema.aiMessages.createdAt);
}

export async function updateThreadTitle(
  db: Db,
  threadId: string,
  title: string,
) {
  await db
    .update(schema.aiThreads)
    .set({ title, updatedAt: new Date() })
    .where(eq(schema.aiThreads.id, threadId));
}

export async function touchThread(db: Db, threadId: string) {
  await db
    .update(schema.aiThreads)
    .set({ updatedAt: new Date() })
    .where(eq(schema.aiThreads.id, threadId));
}

export async function persistMessage(
  db: Db,
  threadId: string,
  role: "user" | "assistant" | "tool",
  content: string,
  opts?: { toolName?: string; toolArgs?: unknown; toolResult?: unknown },
): Promise<void> {
  await db.insert(schema.aiMessages).values({
    threadId,
    role,
    content,
    toolName: opts?.toolName ?? null,
    toolArgs: opts?.toolArgs ?? null,
    toolResult: opts?.toolResult ?? null,
  });
}
