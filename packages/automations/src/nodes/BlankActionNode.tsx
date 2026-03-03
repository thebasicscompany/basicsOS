import { LightningIcon } from "@phosphor-icons/react";
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";

export function BlankActionNode({ selected }: NodeProps<{ type: "action"; data: Record<string, unknown> }>) {
  return (
    <CompactAutomationNode
      icon={<LightningIcon className="size-4 text-amber-500" />}
      title="Choose Action"
      description="Not configured"
      handles={{ target: true, source: true }}
      selected={selected}
    />
  );
}
