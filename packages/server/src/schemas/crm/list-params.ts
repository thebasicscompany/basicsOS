import { z } from "zod";

/** [start, end] for Content-Range pagination */
export const rangeSchema = z
  .tuple([z.number().int().min(0), z.number().int().min(0)])
  .refine(([a, b]) => a <= b, "range start must be <= end");

/** Legacy filter object (e.g. { q: string, category: string }) */
export const filterSchema = z.record(z.string(), z.unknown());

/** Generic filter for column-based filtering */
export const genericFilterSchema = z.object({
  field: z.string().min(1),
  op: z.string().min(1),
  value: z.string(),
  logicalOp: z.enum(["and", "or"]).optional(),
});

export const genericFiltersSchema = z.array(genericFilterSchema);

export const sortDefSchema = z.object({
  field: z.string().min(1),
  order: z.enum(["ASC", "DESC"]).catch("ASC"),
});

export const sortDefsSchema = z.array(sortDefSchema);

export function parseRange(value: string | undefined): [number, number] {
  if (!value) return [0, 24];
  try {
    const parsed = JSON.parse(value) as unknown;
    const result = rangeSchema.safeParse(parsed);
    return result.success ? result.data : [0, 24];
  } catch {
    return [0, 24];
  }
}

export function parseFilter(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    const result = filterSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

export function parseGenericFilters(
  value: string | undefined,
): Array<{ field: string; op: string; value: string; logicalOp?: "and" | "or" }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => genericFilterSchema.safeParse(x))
      .filter(
        (
          r,
        ): r is z.SafeParseSuccess<{
          field: string;
          op: string;
          value: string;
          logicalOp?: "and" | "or";
        }> => r.success,
      )
      .map((r) => r.data);
  } catch {
    return [];
  }
}

export function parseSorts(
  value: string | undefined,
): Array<{ field: string; order: "ASC" | "DESC" }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => sortDefSchema.safeParse(x))
      .filter(
        (
          r,
        ): r is z.SafeParseSuccess<{
          field: string;
          order: "ASC" | "DESC";
        }> => r.success,
      )
      .map((r) => r.data);
  } catch {
    return [];
  }
}
