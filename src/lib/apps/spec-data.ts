// Pure helpers for the declarative app renderer (APP-2). A broker tool result is
// shaped per-tool (e.g. { results: [...] }, { meetings: [...] }, a single row, or
// a bare array). These normalize a result into rows + read/aggregate fields so the
// table/metric/chart blocks don't each special-case tool shapes.

export type Row = Record<string, unknown>;

const ARRAY_KEYS = [
  "results",
  "items",
  "data",
  "rows",
  "records",
  "meetings",
  "transcript",
  "created",
];

/** Normalize a broker tool result into an array of rows. */
export function extractRows(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    for (const key of ARRAY_KEYS) {
      if (Array.isArray(obj[key])) return obj[key] as Row[];
    }
    // A single record (has an id) → one row.
    if ("id" in obj) return [obj];
  }
  return [];
}

/** Read a field off a row, falling back to its custom_fields jsonb bag. */
export function getField(row: Row, field: string): unknown {
  if (row == null) return undefined;
  if (field in row) return row[field];
  const cf = row.custom_fields;
  if (cf && typeof cf === "object" && field in (cf as Record<string, unknown>)) {
    return (cf as Record<string, unknown>)[field];
  }
  return undefined;
}

/** Coerce a value to a finite number, or null. */
function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type Agg = "count" | "sum" | "avg";

/** Aggregate a field across rows. count ignores the field; sum/avg use numerics. */
export function computeMetric(rows: Row[], field: string, agg: Agg): number {
  if (agg === "count") return rows.length;
  const nums = rows
    .map((r) => toNumber(getField(r, field)))
    .filter((n): n is number => n !== null);
  const sum = nums.reduce((a, b) => a + b, 0);
  if (agg === "sum") return sum;
  return nums.length ? sum / nums.length : 0;
}

/** Build {x, y} chart points from rows (y coerced to number, default 0). */
export function toChartData(rows: Row[], x: string, y: string): Array<{ x: string; y: number }> {
  return rows.map((r) => ({
    x: String(getField(r, x) ?? ""),
    y: toNumber(getField(r, y)) ?? 0,
  }));
}

/** Render a cell value as a string for the table block. */
export function formatCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
