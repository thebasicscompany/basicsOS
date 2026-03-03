import { LightningIcon } from "@phosphor-icons/react"
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";

export interface AIActionData {
  prompt?: string;
}

export function AIActionNode({
  data,
  selected,
}: NodeProps<{ type: "action_ai"; data: AIActionData }>) {
  const prompt = data?.prompt?.trim() || "";
  const display =
    prompt.length > 24 ? `${prompt.slice(0, 24)}…` : prompt || "AI Task";

  return (
    <CompactAutomationNode
      icon={<LightningIcon className="size-4 text-amber-400" />}
      title="AI Task"
      description={display}
      handles={{ target: true, source: true }}
      selected={selected}
    />
  );
}
