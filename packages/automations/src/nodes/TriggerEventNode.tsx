import { PlayIcon } from "@phosphor-icons/react"
import type { NodeProps } from "@xyflow/react";
import { CompactAutomationNode } from "./CompactAutomationNode";

const EVENT_OPTIONS = [
  "deal.created",
  "deal.updated",
  "deal.deleted",
  "contact.created",
  "contact.updated",
  "task.created",
  "task.updated",
  "task.deleted",
] as const;

export interface TriggerEventData {
  event?: string;
}

export function TriggerEventNode({
  data,
  selected,
}: NodeProps<{ type: "trigger_event"; data: TriggerEventData }>) {
  const event = data?.event ?? "deal.created";
  const displayTitle =
    EVENT_OPTIONS.includes(event as (typeof EVENT_OPTIONS)[number])
      ? event.replace(".", " ")
      : "Deal created";

  return (
    <CompactAutomationNode
      icon={<PlayIcon className="size-4 text-blue-500" />}
      title={displayTitle}
      description="Trigger"
      handles={{ target: false, source: true }}
      selected={selected}
    />
  );
}
