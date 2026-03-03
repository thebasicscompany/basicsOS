import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CONTACT_STATUS_STYLES: Record<string, string> = {
  cold: "border-blue-200/60 text-blue-600 dark:border-blue-800/60 dark:text-blue-400",
  warm: "border-amber-200/60 text-amber-600 dark:border-amber-800/60 dark:text-amber-400",
  hot: "border-red-200/60 text-red-600 dark:border-red-800/60 dark:text-red-400",
  "in-contract": "border-emerald-200/60 text-emerald-600 dark:border-emerald-800/60 dark:text-emerald-400",
  unqualified: "border-zinc-200/60 text-zinc-500 dark:border-zinc-700/60 dark:text-zinc-400",
};

const DEAL_STAGE_STYLES: Record<string, string> = {
  opportunity: "border-blue-200/60 text-blue-600 dark:border-blue-800/60 dark:text-blue-400",
  "proposal-made": "border-violet-200/60 text-violet-600 dark:border-violet-800/60 dark:text-violet-400",
  "in-negociation": "border-amber-200/60 text-amber-600 dark:border-amber-800/60 dark:text-amber-400",
  won: "border-emerald-200/60 text-emerald-600 dark:border-emerald-800/60 dark:text-emerald-400",
  lost: "border-red-200/60 text-red-600 dark:border-red-800/60 dark:text-red-400",
  delayed: "border-orange-200/60 text-orange-600 dark:border-orange-800/60 dark:text-orange-400",
  new: "border-teal-200/60 text-teal-600 dark:border-teal-800/60 dark:text-teal-400",
};

const DEAL_STAGE_LABELS: Record<string, string> = {
  opportunity: "Opportunity",
  "proposal-made": "Proposal Made",
  "in-negociation": "In Negotiation",
  won: "Won",
  lost: "Lost",
  delayed: "Delayed",
  new: "New",
};

const FALLBACK =
  "border-zinc-200/60 text-zinc-500 dark:border-zinc-700/60 dark:text-zinc-400";

function toLabel(value: string): string {
  return value
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ContactStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <Badge
      variant="outline"
      className={cn("h-5 text-[11px] font-normal", CONTACT_STATUS_STYLES[status] ?? FALLBACK)}
    >
      {toLabel(status)}
    </Badge>
  );
}

export function DealStageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null;
  return (
    <Badge
      variant="outline"
      className={cn("h-5 text-[11px] font-normal", DEAL_STAGE_STYLES[stage] ?? FALLBACK)}
    >
      {DEAL_STAGE_LABELS[stage] ?? toLabel(stage)}
    </Badge>
  );
}

export function SectorBadge({ sector }: { sector: string | null }) {
  if (!sector) return null;
  return (
    <Badge variant="outline" className={cn("h-5 text-[11px] font-normal", FALLBACK)}>
      {sector}
    </Badge>
  );
}
