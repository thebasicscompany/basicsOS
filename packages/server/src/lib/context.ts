import { and, count, desc, eq, isNull, lt, sql, sum } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { writeUsageLogSafe } from "@/lib/usage-log.js";

const MAX_CONTEXT_CHARS_PER_CHUNK = 1_200;
const MAX_TOTAL_CONTEXT_CHARS = 6_000;

function truncateContextText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 3) return text.slice(0, maxChars);
  return `${text.slice(0, maxChars - 3).trimEnd()}...`;
}

/**
 * Builds a brief CRM state summary injected into every AI request.
 * Uses aggregate queries — never loads full records.
 */
export async function buildCrmSummary(
  db: Db,
  organizationId: string
): Promise<string> {
  const [dealStats, overdueStats, recentContacts] = await Promise.all([
    db
      .select({ count: count(), total: sum(schema.deals.amount) })
      .from(schema.deals)
      .where(and(eq(schema.deals.organizationId, organizationId), isNull(schema.deals.archivedAt))),
    db
      .select({ count: count() })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.organizationId, organizationId),
          isNull(schema.tasks.doneDate),
          lt(schema.tasks.dueDate, new Date())
        )
      ),
    db
      .select({ firstName: schema.contacts.firstName, lastName: schema.contacts.lastName })
      .from(schema.contacts)
      .where(eq(schema.contacts.organizationId, organizationId))
      .orderBy(desc(schema.contacts.id))
      .limit(5),
  ]);

  const dealCount = dealStats[0]?.count ?? 0;
  const dealTotal = Number(dealStats[0]?.total ?? 0);
  const overdueCount = overdueStats[0]?.count ?? 0;
  const contactNames = recentContacts
    .map((c) => [c.firstName, c.lastName].filter(Boolean).join(" "))
    .filter(Boolean);

  const lines = [
    `- Open deals: ${dealCount}${dealTotal > 0 ? ` (total value: $${dealTotal.toLocaleString()})` : ""}`,
    `- Overdue tasks: ${overdueCount}`,
  ];
  if (contactNames.length > 0) {
    lines.push(`- Recent contacts: ${contactNames.join(", ")}`);
  }
  return lines.join("\n");
}

/**
 * Embeds the query and runs a pgvector similarity search against context_embeddings.
 * Returns formatted top-K results, or null if unavailable/empty.
 */
export async function retrieveRelevantContext(
  db: Db,
  gatewayUrl: string,
  gatewayHeaders: Record<string, string>,
  organizationId: string,
  query: string,
  limit = 5,
  crmUserId?: number,
): Promise<string | null> {
  if (!query.trim()) return null;

  try {
    const embRes = await fetch(`${gatewayUrl}/v1/embeddings`, {
      method: "POST",
      headers: gatewayHeaders,
      body: JSON.stringify({ model: "basics-embed", input: query }),
    });

    if (!embRes.ok) {
      await embRes.text().catch(() => {});
      return null;
    }

    const embJson = (await embRes.json()) as {
      data?: Array<{ embedding?: number[] }>;
      usage?: { prompt_tokens?: number; total_tokens?: number };
    };
    const embedding = embJson.data?.[0]?.embedding;
    if (!embedding?.length) return null;

    if (crmUserId != null) {
      const fromApi =
        embJson.usage?.prompt_tokens ?? embJson.usage?.total_tokens ?? 0;
      const inputTokens =
        fromApi > 0 ? fromApi : Math.max(1, Math.ceil(query.length / 4));
      writeUsageLogSafe(db, {
        organizationId,
        crmUserId,
        feature: "embedding_rag",
        model: "basics-embed",
        inputTokens,
      });
    }

    const embeddingStr = `[${embedding.join(",")}]`;
    const rows = await db.execute(sql`
      SELECT entity_type, chunk_text
      FROM context_embeddings
      WHERE organization_id = ${organizationId}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    const results = (
      Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? [])
    ) as { entity_type: string; chunk_text: string }[];

    if (results.length === 0) return null;

    const lines: string[] = [];
    let remainingChars = MAX_TOTAL_CONTEXT_CHARS;
    for (const result of results) {
      const prefix = `[${result.entity_type}] `;
      const availableChars = Math.min(
        MAX_CONTEXT_CHARS_PER_CHUNK,
        Math.max(0, remainingChars - prefix.length),
      );
      if (availableChars <= 0) break;
      const chunkText = truncateContextText(result.chunk_text, availableChars);
      if (!chunkText) continue;
      const line = `${prefix}${chunkText}`;
      lines.push(line);
      remainingChars -= line.length + 1;
      if (remainingChars <= 0) break;
    }

    return lines.length > 0 ? lines.join("\n") : null;
  } catch {
    return null;
  }
}
