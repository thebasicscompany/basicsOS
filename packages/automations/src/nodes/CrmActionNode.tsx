import { ListChecksIcon } from "@phosphor-icons/react"
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";

export interface CrmActionData {
  action?: string;
  params?: { text?: string; type?: string; contactId?: number };
}

export function CrmActionNode({
  data,
  selected,
}: NodeProps<{ type: "action_crm"; data: CrmActionData }>) {
  const action = data?.action ?? "create_task";
  const label = action === "create_task" ? "Create task" : action;

  return (
    <CompactAutomationNode
      icon={<ListChecksIcon className="size-4 text-green-500" />}
      title="CRM Action"
      description={label}
      handles={{ target: true, source: true }}
      selected={selected}
    />
  );
}
