import { ClockIcon } from "@phosphor-icons/react"
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";

export interface TriggerScheduleData {
  cron?: string;
  label?: string;
}

export function TriggerScheduleNode({
  data,
  selected,
}: NodeProps<{ type: "trigger_schedule"; data: TriggerScheduleData }>) {
  const label = data?.label?.trim() || (data?.cron ? `Cron: ${data.cron}` : "Schedule");

  return (
    <CompactAutomationNode
      icon={<ClockIcon className="size-4 text-blue-500" />}
      title={label}
      description="Schedule"
      handles={{ target: false, source: true }}
      selected={selected}
    />
  );
}
