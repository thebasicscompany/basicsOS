import { EnvelopeIcon } from "@phosphor-icons/react"
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";

export interface EmailActionData {
  to?: string;
  subject?: string;
  body?: string;
}

export function EmailActionNode({
  data,
  selected,
}: NodeProps<{ type: "action_email"; data: EmailActionData }>) {
  const to = data?.to?.trim() || "";
  const display = to ? (to.length > 20 ? `${to.slice(0, 20)}…` : to) : "Send Email";

  return (
    <CompactAutomationNode
      icon={<EnvelopeIcon className="size-4 text-amber-400" />}
      title="Send Email"
      description={display}
      handles={{ target: true, source: true }}
      selected={selected}
    />
  );
}
