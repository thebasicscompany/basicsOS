import { SparkleIcon } from "@phosphor-icons/react"
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";

export interface AIAgentData {
  objective?: string;
  model?: string;
  maxSteps?: number;
}

export function AIAgentNode({
  data,
  selected,
}: NodeProps<{ type: "action_ai_agent"; data: AIAgentData }>) {
  const objective = data?.objective?.trim() || "";
  const display =
    objective.length > 24 ? `${objective.slice(0, 24)}…` : objective || "AI Agent";

  return (
    <CompactAutomationNode
      icon={<SparkleIcon className="size-4 text-purple-400" />}
      title="AI Agent"
      description={display}
      handles={{ target: true, source: true }}
      selected={selected}
    />
  );
}
