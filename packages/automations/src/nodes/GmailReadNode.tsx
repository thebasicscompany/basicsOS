import { TrayIcon } from "@phosphor-icons/react"
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";
import { useAutomationBuilder } from "../AutomationBuilderContext";

export interface GmailReadData {
  query?: string;
  maxResults?: number;
}

export function GmailReadNode({
  data,
  selected,
}: NodeProps<{ type: "action_gmail_read"; data: GmailReadData }>) {
  const { connectedProviders } = useAutomationBuilder();
  const query = data?.query?.trim() || "is:unread";
  const display =
    query.length > 20 ? `${query.slice(0, 20)}…` : query || "Gmail Read";
  const connectionRequired = !connectedProviders.includes("google");

  return (
    <CompactAutomationNode
      icon={<TrayIcon className="size-4 text-red-400" />}
      title="Gmail Read"
      description={display}
      handles={{ target: true, source: true }}
      selected={selected}
      connectionRequired={connectionRequired}
    />
  );
}
