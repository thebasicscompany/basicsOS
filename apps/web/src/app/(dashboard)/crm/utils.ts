import type { DealStage } from "./types";

// ---------------------------------------------------------------------------
// Select/Multi-select option colors
// ---------------------------------------------------------------------------

export const OPTION_COLORS = [
  { name: "gray",   dot: "bg-stone-400",   badge: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
  { name: "red",    dot: "bg-red-500",     badge: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  { name: "orange", dot: "bg-orange-500",  badge: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  { name: "amber",  dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { name: "green",  dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { name: "teal",   dot: "bg-teal-500",    badge: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  { name: "blue",   dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { name: "indigo", dot: "bg-indigo-500",  badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" },
  { name: "purple", dot: "bg-purple-500",  badge: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  { name: "pink",   dot: "bg-pink-500",    badge: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
] as const;

export interface SelectOption {
  label: string;
  value: string;
  color: string;
}

/** Normalizes legacy string[] and new object[] options into SelectOption[]. */
export function normalizeOptions(raw: unknown): SelectOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    if (typeof item === "string") {
      return { label: item, value: item, color: OPTION_COLORS[i % OPTION_COLORS.length]!.name };
    }
    return item as SelectOption;
  });
}

/** Returns dot + badge class strings for a color name. */
export function getOptionColor(colorName: string): { dot: string; badge: string } {
  const found = OPTION_COLORS.find((c) => c.name === colorName);
  return found
    ? { dot: found.dot, badge: found.badge }
    : { dot: OPTION_COLORS[0]!.dot, badge: OPTION_COLORS[0]!.badge };
}

export const STAGES: readonly DealStage[] = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export const STAGE_COLORS: Record<string, string> = {
  lead: "bg-stone-400 dark:bg-stone-500",
  qualified: "bg-blue-500",
  proposal: "bg-amber-500",
  negotiation: "bg-purple-500",
  won: "bg-emerald-500",
  lost: "bg-red-500",
};

const AVATAR_COLORS = [
  "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
  "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
];

export const nameToColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0] ?? "";
};

export const formatCurrency = (value: number): string =>
  value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
      ? `$${(value / 1_000).toFixed(1)}k`
      : `$${value.toLocaleString()}`;

export function exportCsv<T>(
  rows: T[],
  columns: Array<{ key: string; label: string; value: (row: T) => string }>,
  filename: string,
): void {
  const header = columns.map((c) => c.label);
  const csvRows = rows.map((row) =>
    columns.map((c) => {
      const val = c.value(row);
      return val.includes(",") || val.includes('"') || val.includes("\n")
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }),
  );
  const csv = [header.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
