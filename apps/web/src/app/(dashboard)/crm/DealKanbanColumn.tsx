"use client";

import { useState } from "react";
import { SectionLabel } from "@basicsos/ui";
import { DealCard } from "./DealCard";
import { STAGE_COLORS, formatCurrency } from "./utils";
import type { DealStage } from "./types";

interface Deal {
  id: string;
  title: string;
  stage: DealStage;
  value: string;
  probability: number;
}

interface DealKanbanColumnProps {
  stage: DealStage;
  deals: Deal[];
}

export const DealKanbanColumn = ({ stage, deals }: DealKanbanColumnProps): JSX.Element => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (): void => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(false);
    const dealId = e.dataTransfer.getData("dealId");
    if (dealId) {
      const event = new CustomEvent("deal:move", { detail: { dealId, stage } });
      document.dispatchEvent(event);
    }
  };

  const totalValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-52 flex-shrink-0 rounded-sm transition-colors ${isDragOver ? "bg-primary/5" : ""}`}
    >
      <ColumnHeader stage={stage} count={deals.length} />
      <div className="flex flex-col gap-2">
        {deals.length === 0 ? (
          <ColumnEmptyState />
        ) : (
          deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
        )}
      </div>
      {deals.length > 0 && <ColumnFooter count={deals.length} total={totalValue} />}
    </div>
  );
};

function ColumnHeader({ stage, count }: { stage: string; count: number }): JSX.Element {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${STAGE_COLORS[stage] ?? "bg-stone-400"}`} />
      <SectionLabel as="span" className="!mb-0 flex-1">
        {stage}
      </SectionLabel>
      <span className="rounded-full bg-stone-200 dark:bg-stone-700 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:text-stone-400">
        {count}
      </span>
    </div>
  );
}

function ColumnEmptyState(): JSX.Element {
  return (
    <div className="rounded-sm border-2 border-dashed border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30 py-8 px-4 text-center">
      <p className="text-xs text-stone-500 dark:text-stone-400">No deals</p>
      <p className="mt-1 text-[10px] text-stone-400 dark:text-stone-500">Drag or create a deal</p>
    </div>
  );
}

function ColumnFooter({ count, total }: { count: number; total: number }): JSX.Element {
  return (
    <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-stone-500 dark:text-stone-400">
      <span>{count} deal{count !== 1 ? "s" : ""}</span>
      <span className="font-medium tabular-nums">{formatCurrency(total)}</span>
    </div>
  );
}
