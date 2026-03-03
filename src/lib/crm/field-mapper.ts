/**
 * snake_case ↔ camelCase conversion for API records.
 *
 * The API uses PostgreSQL column names (snake_case) from introspection.
 * The React frontend uses camelCase.
 */

export function snakeToCamel(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    // NocoDB returns "Id" as the primary key — normalize to "id"
    const normalized = key === "Id" ? "id" : key;
    const camel = normalized.replace(/_([a-z])/g, (_, c: string) =>
      c.toUpperCase(),
    );
    result[camel] = value;
  }
  return result;
}

export function camelToSnake(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    result[snake] = value;
  }
  return result;
}

/** Convert an array of API records from snake_case to camelCase */
export function mapRecords(
  records: Record<string, unknown>[],
): Record<string, unknown>[] {
  return records.map(snakeToCamel);
}

/** Convert a single camelCase record to snake_case for API writes */
export function unmapRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return camelToSnake(record);
}
