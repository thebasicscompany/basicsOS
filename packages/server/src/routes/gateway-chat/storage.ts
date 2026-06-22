import { and, eq, desc, inArray } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import {
  createEmptyThreadEntityMemory,
  normalizeThreadEntityMemory,
  type ThreadEntityMemory,
} from "@/routes/gateway-chat/protocol.js";

const THREAD_ENTITY_MEMORY_KIND = "entity_state";
const THREAD_ENTITY_MEMORY_KEY = "thread_entities";

/** A short thread title from the first user message (first line, ~60 chars). */
function titleFromMessage(text?: string): string | undefined {
  const t = text?.trim().split("\n")[0].trim();
  if (!t) return undefined;
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

export async function ensureThread(
  db: Db,
  crmUser: typeof schema.crmUsers.$inferSelect,
  threadIdRaw?: string,
  channelRaw?: string,
  firstMessage?: string,
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

  const title = titleFromMessage(firstMessage);
  const [inserted] = await db
    .insert(schema.aiThreads)
    .values({
      crmUserId: crmUser.id,
      organizationId: crmUser.organizationId,
      channel,
      ...(title ? { title } : {}),
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

  const MAX_HISTORY_MESSAGES = 50;
  const rows = await db
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
    .orderBy(desc(schema.aiMessages.createdAt))
    .limit(MAX_HISTORY_MESSAGES);

  return rows.reverse();
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

export async function getThreadEntityMemory(
  db: Db,
  threadId: string,
  organizationId: string,
): Promise<ThreadEntityMemory> {
  const rows = await db
    .select({
      value: schema.aiMemoryItems.value,
    })
    .from(schema.aiMemoryItems)
    .where(
      and(
        eq(schema.aiMemoryItems.organizationId, organizationId),
        eq(schema.aiMemoryItems.scope, "thread"),
        eq(schema.aiMemoryItems.threadId, threadId),
        eq(schema.aiMemoryItems.kind, THREAD_ENTITY_MEMORY_KIND),
        eq(schema.aiMemoryItems.key, THREAD_ENTITY_MEMORY_KEY),
      ),
    )
    .limit(1);

  return rows[0]
    ? normalizeThreadEntityMemory(rows[0].value)
    : createEmptyThreadEntityMemory();
}

export async function saveThreadEntityMemory(
  db: Db,
  args: {
    threadId: string;
    organizationId: string;
    crmUserId: number;
    memory: ThreadEntityMemory;
  },
): Promise<void> {
  const existing = await db
    .select({ id: schema.aiMemoryItems.id })
    .from(schema.aiMemoryItems)
    .where(
      and(
        eq(schema.aiMemoryItems.organizationId, args.organizationId),
        eq(schema.aiMemoryItems.scope, "thread"),
        eq(schema.aiMemoryItems.threadId, args.threadId),
        eq(schema.aiMemoryItems.kind, THREAD_ENTITY_MEMORY_KIND),
        eq(schema.aiMemoryItems.key, THREAD_ENTITY_MEMORY_KEY),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.aiMemoryItems)
      .set({
        crmUserId: args.crmUserId,
        value: args.memory,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiMemoryItems.id, existing[0].id));
    return;
  }

  await db.insert(schema.aiMemoryItems).values({
    organizationId: args.organizationId,
    crmUserId: args.crmUserId,
    scope: "thread",
    threadId: args.threadId,
    kind: THREAD_ENTITY_MEMORY_KIND,
    key: THREAD_ENTITY_MEMORY_KEY,
    value: args.memory,
    importance: 8,
  });
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
