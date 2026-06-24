import { describe, expect, it } from "vitest";
import {
  computeMetric,
  extractRows,
  formatCell,
  getField,
  toChartData,
} from "@/lib/apps/spec-data";

describe("extractRows", () => {
  it("returns a bare array as-is", () => {
    expect(extractRows([{ id: 1 }, { id: 2 }])).toHaveLength(2);
  });
  it("pulls rows from common array keys", () => {
    expect(extractRows({ results: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    expect(extractRows({ meetings: [{ id: 9 }] })).toEqual([{ id: 9 }]);
  });
  it("wraps a single record (has id) into one row", () => {
    expect(extractRows({ id: 5, name: "x" })).toEqual([{ id: 5, name: "x" }]);
  });
  it("returns [] for empty / unknown shapes", () => {
    expect(extractRows(null)).toEqual([]);
    expect(extractRows({ note: "no array, no id" })).toEqual([]);
  });
});

describe("getField", () => {
  it("reads a top-level field", () => {
    expect(getField({ amount: 10 }, "amount")).toBe(10);
  });
  it("falls back to custom_fields", () => {
    expect(getField({ custom_fields: { region: "EU" } }, "region")).toBe("EU");
  });
  it("prefers top-level over custom_fields", () => {
    expect(getField({ region: "US", custom_fields: { region: "EU" } }, "region")).toBe("US");
  });
});

describe("computeMetric", () => {
  const rows = [{ amount: 100 }, { amount: "250" }, { amount: null }, { other: 1 }];
  it("counts rows", () => {
    expect(computeMetric(rows, "amount", "count")).toBe(4);
  });
  it("sums numeric (coercing strings, ignoring non-numbers)", () => {
    expect(computeMetric(rows, "amount", "sum")).toBe(350);
  });
  it("averages numeric values only", () => {
    expect(computeMetric(rows, "amount", "avg")).toBe(175);
  });
  it("avg of no numerics is 0", () => {
    expect(computeMetric([{ a: 1 }], "amount", "avg")).toBe(0);
  });
});

describe("toChartData / formatCell", () => {
  it("builds x/y points with numeric y", () => {
    expect(toChartData([{ owner: "Ana", total: "5" }], "owner", "total")).toEqual([
      { x: "Ana", y: 5 },
    ]);
  });
  it("formats cells", () => {
    expect(formatCell(null)).toBe("");
    expect(formatCell(42)).toBe("42");
    expect(formatCell({ a: 1 })).toBe('{"a":1}');
  });
});
