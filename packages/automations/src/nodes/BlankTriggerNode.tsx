import { PlayIcon } from "@phosphor-icons/react";
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";

export function BlankTriggerNode({ selected }: NodeProps<{ type: "trigger"; data: Record<string, unknown> }>) {
  return (
    <CompactAutomationNode
      icon={<PlayIcon className="size-4 text-blue-500" />}
      title="Choose Event"
      description="Not configured"
      handles={{ target: false, source: true }}
      selected={selected}
    />
  );
}
