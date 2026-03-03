import type { ReactNode } from "react";
import { WarningIcon } from "@phosphor-icons/react";
import {
  WorkflowNode,
  NodeTitle,
  NodeDescription,
} from "basics-os/src/components/ai-elements/node";
import { cn } from "basics-os/src/lib/utils";

export interface CompactAutomationNodeProps {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  handles: { target: boolean; source: boolean };
  selected?: boolean;
  /** Show warning badge when connection is required but not connected */
  connectionRequired?: boolean;
}

/**
 * Shared base for compact automation nodes (icon + title + description).
 * Used by all trigger and action nodes in the automation builder.
 */
export function CompactAutomationNode({
  icon,
  title,
  description,
  handles,
  selected,
  connectionRequired,
}: CompactAutomationNodeProps) {
  return (
    <WorkflowNode
      className={cn(
        "flex w-32 flex-col items-center justify-center shadow-none transition-all duration-150 ease-out",
        selected && "border-primary",
        connectionRequired && "ring-1 ring-amber-500/50"
      )}
      handles={handles}
    >
      <div className="relative flex flex-col items-center justify-center gap-1.5 p-2">
        {connectionRequired && (
          <span
            className="absolute -top-1 -right-1 rounded-full bg-amber-500 p-0.5"
            title="Connect required"
          >
            <WarningIcon className="size-2.5 text-white" weight="fill" />
          </span>
        )}
        {icon}
        <div className="flex flex-col items-center gap-1 text-center">
          <NodeTitle className="text-sm">{title}</NodeTitle>
          <NodeDescription className="text-xs">{description}</NodeDescription>
        </div>
      </div>
    </WorkflowNode>
  );
}
