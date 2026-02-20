"use client";

import { Badge, Card } from "@basicsos/ui";
import type { DealStage } from "./types";

interface Deal {
  id: string;
  title: string;
  stage: DealStage;
  value: string;
  probability: number;
}

const STAGE_VARIANT: Record<
  DealStage,
  "secondary" | "default" | "warning" | "destructive" | "success" | "outline"
> = {
  lead: "secondary",
  qualified: "default",
  proposal: "warning",
  negotiation: "warning",
  won: "success",
  lost: "destructive",
};

interface DealCardProps {
  deal: Deal;
}

export const DealCard = ({ deal }: DealCardProps): JSX.Element => (
  <Card className="p-3 cursor-pointer transition-colors hover:bg-stone-50">
    <p className="text-sm font-medium text-stone-900 truncate">{deal.title}</p>
    <div className="mt-2 flex items-center justify-between gap-1">
      <Badge variant={STAGE_VARIANT[deal.stage]}>{deal.stage}</Badge>
      <span className="text-xs font-medium text-stone-600">
        ${Number(deal.value).toLocaleString()}
      </span>
    </div>
  </Card>
);
