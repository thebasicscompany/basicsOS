import * as crmApi from "@/lib/api/crm";
import { buildImportPayload } from "@/components/import/import-utils";
import type { ParsedCSV } from "@/components/import/import-utils";
import type { ColumnMapping, ConflictBehavior } from "./use-import";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

const BATCH_SIZE = 25;

function getMergeValue(
  payload: Record<string, unknown>,
  mergeKey: string,
): string | undefined {
  if (!mergeKey) return undefined;
  if (mergeKey === "email") {
    return (
      (payload.email as string) ??
      (payload.emailJsonb as { email: string }[])?.[0]?.email
    );
  }
  return payload[mergeKey] as string | undefined;
}

export async function executeImport(
  objectSlug: string,
  parsed: ParsedCSV,
  mapping: ColumnMapping,
  customFieldNames: Set<string>,
  mergeKey: string,
  conflictBehavior: ConflictBehavior,
): Promise<ImportResult> {
  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  const resource = objectSlug;
  const shouldMerge = mergeKey && conflictBehavior !== "create_only";

  // Fast path: no merge/dedup → one bulk insert per chunk (not N requests).
  if (!shouldMerge) {
    const BULK_CHUNK = 250;
    const payloads = parsed.rows.map((row) =>
      buildImportPayload(objectSlug, row, mapping, customFieldNames),
    );
    for (let i = 0; i < payloads.length; i += BULK_CHUNK) {
      const chunk = payloads.slice(i, i + BULK_CHUNK);
      try {
        const res = await crmApi.bulkCreate(resource, chunk);
        result.created += res.created.length;
        for (const e of res.errors) {
          result.errors.push({ row: i + e.index + 1, message: e.message });
        }
      } catch (err) {
        for (let j = 0; j < chunk.length; j++) {
          result.errors.push({
            row: i + j + 1,
            message: err instanceof Error ? err.message : "Bulk insert failed",
          });
        }
      }
    }
    return result;
  }

  for (let i = 0; i < parsed.rows.length; i += BATCH_SIZE) {
    const batch = parsed.rows.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (row, batchIdx) => {
        const rowNum = i + batchIdx + 1;
        try {
          const payload = buildImportPayload(
            objectSlug,
            row,
            mapping,
            customFieldNames,
          );
          const mergeValue = getMergeValue(payload, mergeKey);

          if (shouldMerge && mergeValue) {
            const { data } = await crmApi.getList<{ id: number }>(resource, {
              pagination: { page: 1, perPage: 1 },
              viewFilters: [{ field: mergeKey, op: "eq", value: mergeValue }],
            });
            const existing = data[0];
            if (existing) {
              if (conflictBehavior === "skip_duplicates") {
                result.skipped++;
                return;
              }
              if (conflictBehavior === "update_existing") {
                await crmApi.update(resource, existing.id, payload);
                result.updated++;
                return;
              }
            }
          }

          await crmApi.create(resource, payload);
          result.created++;
        } catch (err) {
          result.errors.push({
            row: rowNum,
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }),
    );
  }

  return result;
}
