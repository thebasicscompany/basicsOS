import { ChatCircleIcon } from "@phosphor-icons/react"
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";
import { useAutomationBuilder } from "../AutomationBuilderContext";

export interface SlackActionData {
  channel?: string;
  message?: string;
}

export function SlackActionNode({
  data,
  selected,
}: NodeProps<{ type: "action_slack"; data: SlackActionData }>) {
  const { connectedProviders } = useAutomationBuilder();
  const channel = data?.channel?.trim() || "";
  const display = channel ? (channel.length > 20 ? `${channel.slice(0, 20)}…` : channel) : "Slack Message";
  const connectionRequired = !connectedProviders.includes("slack");

  return (
    <CompactAutomationNode
      icon={<ChatCircleIcon className="size-4 text-blue-400" />}
      title="Slack Message"
      description={display}
      handles={{ target: true, source: true }}
      selected={selected}
      connectionRequired={connectionRequired}
    />
  );
}
