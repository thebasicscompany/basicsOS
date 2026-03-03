import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";

export interface WebSearchActionData {
  query?: string;
  numResults?: number;
}

export function WebSearchActionNode({
  data,
  selected,
}: NodeProps<{ type: "action_web_search"; data: WebSearchActionData }>) {
  const query = data?.query?.trim() || "";
  const display =
    query.length > 20 ? `${query.slice(0, 20)}…` : query || "Web Search";

  return (
    <CompactAutomationNode
      icon={<MagnifyingGlassIcon className="size-4 text-blue-400" />}
      title="Web Search"
      description={display}
      handles={{ target: true, source: true }}
      selected={selected}
    />
  );
}
