"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Card, CardContent, IconBadge, Zap } from "@basicsos/ui";
import { getTriggerLabel } from "../../trigger-meta";
import type { WorkflowTriggerNode } from "../workflow-flow-types";

export const TriggerNode = memo(function TriggerNode({ data, selected }: NodeProps<WorkflowTriggerNode>) {
  const label = getTriggerLabel(data.eventType || "task.created");
  return (
    <>
      <Card
        className={`min-w-[200px] shadow-md transition-shadow ${selected ? "ring-2 ring-primary" : ""}`}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <IconBadge Icon={Zap} size="sm" color="bg-orange-50 text-orange-600" />
            <div>
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Trigger
              </p>
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{label}</p>
            </div>
          </div>
          {Array.isArray(data.conditions) && data.conditions.length > 0 && (
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              {data.conditions.length} condition{data.conditions.length !== 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} className="!bottom-0 !w-3 !h-3 !border-2 !border-primary !bg-background" />
    </>
  );
});
