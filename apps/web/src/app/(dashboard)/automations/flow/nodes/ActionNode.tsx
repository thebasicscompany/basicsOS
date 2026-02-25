"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Card, CardContent, IconBadge } from "@basicsos/ui";
import { getActionPrimitive } from "../../action-primitives";
import type { WorkflowActionNode } from "../workflow-flow-types";

export const ActionNode = memo(function ActionNode({ data, selected }: NodeProps<WorkflowActionNode>) {
  const primitive = getActionPrimitive(data.type ?? "create_task");
  const summary = primitive ? primitive.summary(data.config ?? {}) : (data.type ?? "Action");
  return (
    <>
      <Handle type="target" position={Position.Top} className="!top-0 !w-3 !h-3 !border-2 !border-primary !bg-background" />
      <Card
        className={`min-w-[220px] shadow-md transition-shadow ${selected ? "ring-2 ring-primary" : ""}`}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            {primitive ? (
              <IconBadge Icon={primitive.Icon} size="sm" color={primitive.color} />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-stone-200 dark:bg-stone-700 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Action
              </p>
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                {primitive?.label ?? data.type ?? "Action"}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">{summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} className="!bottom-0 !w-3 !h-3 !border-2 !border-primary !bg-background" />
    </>
  );
});
