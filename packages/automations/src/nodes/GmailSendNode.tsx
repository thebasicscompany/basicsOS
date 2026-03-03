import { PaperPlaneTiltIcon } from "@phosphor-icons/react"
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";
import { useAutomationBuilder } from "../AutomationBuilderContext";

export interface GmailSendData {
  to?: string;
  subject?: string;
  body?: string;
}

export function GmailSendNode({
  data,
  selected,
}: NodeProps<{ type: "action_gmail_send"; data: GmailSendData }>) {
  const { connectedProviders } = useAutomationBuilder();
  const to = data?.to?.trim() || "";
  const display = to ? (to.length > 20 ? `${to.slice(0, 20)}…` : to) : "Send Gmail";
  const connectionRequired = !connectedProviders.includes("google");

  return (
    <CompactAutomationNode
      icon={<PaperPlaneTiltIcon className="size-4 text-red-400" />}
      title="Gmail Send"
      description={display}
      handles={{ target: true, source: true }}
      selected={selected}
      connectionRequired={connectionRequired}
    />
  );
}
