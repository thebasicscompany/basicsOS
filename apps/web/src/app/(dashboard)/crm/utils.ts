import type { DealStage } from "./types";

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
