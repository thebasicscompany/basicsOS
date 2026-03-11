import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import type { EnrichmentResult } from "./types.js";
import { aiExtractStructured, extractFromWebSearch } from "./ai-extract.js";
import { mergeEnrichmentData } from "./merge.js";

export async function enrichEntity(params: {
  db: Db;
  organizationId: string;
  crmUserId: number;
  entityType: "contact" | "company";
  entityId: number;
  force?: boolean;
  gatewayUrl: string;
  gatewayHeaders: Record<string, string>;
  env: Record<string, string>;
}): Promise<EnrichmentResult> {
  const {
    db,
    organizationId,
    crmUserId,
    entityType,
    entityId,
    force,
    gatewayUrl,
    gatewayHeaders,
    env,
  } = params;

  // 1. Load existing record
  const table =
    entityType === "contact" ? schema.contacts : schema.companies;
  const [record] = await db
    .select()
    .from(table)
    .where(
      and(eq(table.id, entityId), eq(table.organizationId, organizationId)),
    )
    .limit(1);
  if (!record) throw new Error(`${entityType} ${entityId} not found`);

  // 2. Skip if recently enriched (unless force)
  const customFields =
    (record.customFields as Record<string, unknown>) ?? {};
  if (!force && customFields._enrichedAt) {
    const enrichedAt = new Date(customFields._enrichedAt as string);
    if (Date.now() - enrichedAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return {
        entityType,
        entityId,
        fieldsUpdated: [],
        data: {},
        sources: [],
      };
    }
  }

  // 3. Build search query from record data
  const recordData = record as Record<string, unknown>;
  const searchQuery =
    entityType === "contact"
      ? [recordData.firstName, recordData.lastName, recordData.email]
          .filter(Boolean)
          .join(" ")
          .trim()
      : [recordData.name, recordData.domain]
          .filter(Boolean)
          .join(" ")
          .trim();

  if (!searchQuery) {
    return {
      entityType,
      entityId,
      fieldsUpdated: [],
      data: {},
      sources: [],
    };
  }

  // 4. Gather data from web search
  let gatheredData: Record<string, unknown> = {};
  const usedSources: string[] = [];

  const webData = await extractFromWebSearch(
    searchQuery,
    gatewayUrl,
    gatewayHeaders,
    env,
  );
  if (webData && Object.keys(webData).length) {
    gatheredData = { ...gatheredData, ...webData };
    usedSources.push("web_search");
  }

  // 5. AI structured extraction (refine gathered data)
  if (Object.keys(gatheredData).length > 0) {
    const aiRefined = await aiExtractStructured(
      gatheredData,
      entityType,
      gatewayUrl,
      gatewayHeaders,
    );
    if (aiRefined) {
      gatheredData = { ...gatheredData, ...aiRefined };
    }
    usedSources.push("ai_extract");
  }

  // 6. Merge into record (fill empty only)
  const { mergedFields, fieldsUpdated } = mergeEnrichmentData(
    customFields,
    gatheredData,
    recordData,
  );

  // 7. Write back to DB
  if (fieldsUpdated.length > 0) {
    const newCustomFields = {
      ...customFields,
      ...mergedFields,
      _enrichedAt: new Date().toISOString(),
    };
    await db
      .update(table)
      .set({ customFields: newCustomFields })
      .where(eq(table.id, entityId));

    // 8. Update embedding with enriched data
    try {
      const { buildEntityText, upsertEntityEmbedding } = await import(
        "../embeddings.js"
      );
      const enrichedRecord = { ...recordData, customFields: newCustomFields };
      const text = buildEntityText(entityType, enrichedRecord);
      const enrichmentSummary = Object.entries(mergedFields)
        .map(([k, v]) => `${k}: ${v}`)
        .join(". ");
      const apiKey =
        gatewayHeaders["authorization"]?.replace("Bearer ", "") ?? "";
      await upsertEntityEmbedding(
        db,
        gatewayUrl,
        apiKey,
        crmUserId,
        entityType,
        entityId,
        `${text}. ${enrichmentSummary}`,
      );
    } catch {
      // Embedding update is best-effort
    }
  } else {
    // Mark as enriched even if no new data
    await db
      .update(table)
      .set({
        customFields: {
          ...customFields,
          _enrichedAt: new Date().toISOString(),
        },
      })
      .where(eq(table.id, entityId));
  }

  return {
    entityType,
    entityId,
    fieldsUpdated,
    data: mergedFields,
    sources: usedSources,
  };
}
