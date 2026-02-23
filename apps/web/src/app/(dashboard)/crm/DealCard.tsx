"use client";

import Link from "next/link";
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
  <Link href={`/crm/deals/${deal.id}`} className="block">
    <Card className="cursor-pointer p-3 transition-colors hover:bg-accent/50">
      <p className="truncate text-sm font-medium text-foreground">{deal.title}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <Badge variant={STAGE_VARIANT[deal.stage]} className="text-[10px]">{deal.stage}</Badge>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          ${Number(deal.value).toLocaleString()}
        </span>
      </div>
    </Card>
  </Link>
);
