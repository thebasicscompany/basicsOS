import { and, count, desc, eq, isNull, lt, sql, sum } from "drizzle-orm";
import * as schema from "../db/schema/index.js";
/**
 * Builds a brief CRM state summary injected into every AI request.
 * Uses aggregate queries — never loads full records.
 */
export async function buildCrmSummary(db, organizationId) {
    const [dealStats, overdueStats, recentContacts] = await Promise.all([
        db
            .select({ count: count(), total: sum(schema.deals.amount) })
            .from(schema.deals)
            .where(and(eq(schema.deals.organizationId, organizationId), isNull(schema.deals.archivedAt))),
        db
            .select({ count: count() })
            .from(schema.tasks)
            .where(and(eq(schema.tasks.organizationId, organizationId), isNull(schema.tasks.doneDate), lt(schema.tasks.dueDate, new Date()))),
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
export async function retrieveRelevantContext(db, gatewayUrl, apiKey, organizationId, query, limit = 5) {
    if (!query.trim())
        return null;
    try {
        const embRes = await fetch(`${gatewayUrl}/v1/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model: "basics-embed", input: query }),
        });
        if (!embRes.ok)
            return null;
        const embJson = (await embRes.json());
        const embedding = embJson.data?.[0]?.embedding;
        if (!embedding?.length)
            return null;
        const embeddingStr = `[${embedding.join(",")}]`;
        const rows = await db.execute(sql `
      SELECT entity_type, chunk_text
      FROM context_embeddings
      WHERE organization_id = ${organizationId}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);
        const results = (Array.isArray(rows) ? rows : (rows.rows ?? []));
        if (results.length === 0)
            return null;
        return results.map((r) => `[${r.entity_type}] ${r.chunk_text}`).join("\n");
    }
    catch {
        return null;
    }
}
