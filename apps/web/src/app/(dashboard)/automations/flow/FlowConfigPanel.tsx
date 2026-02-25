"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SectionLabel,
  IconBadge,
  Zap,
} from "@basicsos/ui";
import { TRIGGER_META, getTriggerLabel } from "../trigger-meta";
import { ACTION_PRIMITIVES, getActionPrimitive } from "../action-primitives";
import type { TriggerNodeData, ActionNodeData } from "./workflow-flow-types";
import type { Node } from "@xyflow/react";

const TRIGGER_OPTIONS = Object.entries(TRIGGER_META).sort(
  (a, b) => a[1].group.localeCompare(b[1].group) || a[1].label.localeCompare(b[1].label),
);

type Props = {
  selectedNode: Node<TriggerNodeData, "trigger"> | Node<ActionNodeData, "action"> | null;
  onUpdateTrigger: (data: Partial<TriggerNodeData>) => void;
  onUpdateAction: (nodeId: string, data: Partial<ActionNodeData>) => void;
};

export function FlowConfigPanel({ selectedNode, onUpdateTrigger, onUpdateAction }: Props): JSX.Element {
  if (!selectedNode) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
          Select a trigger or action node to edit.
        </CardContent>
      </Card>
    );
  }

  if (selectedNode.type === "trigger") {
    const data = selectedNode.data as TriggerNodeData;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <IconBadge Icon={Zap} size="sm" color="bg-orange-50 text-orange-600" />
            Trigger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>When</Label>
            <Select
              value={data.eventType || "task.created"}
              onValueChange={(eventType) => onUpdateTrigger({ eventType })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event…" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            This automation runs when {getTriggerLabel(data.eventType || "task.created").toLowerCase()}.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (selectedNode.type === "action") {
    const data = selectedNode.data as ActionNodeData;
    const primitive = getActionPrimitive(data.type || "create_task");
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {primitive ? (
              <IconBadge Icon={primitive.Icon} size="sm" color={primitive.color} />
            ) : (
              <div className="h-6 w-6 rounded-lg bg-stone-200 dark:bg-stone-700" />
            )}
            Action — {primitive?.label ?? data.type ?? "Unknown"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Action type</Label>
            <Select
              value={data.type || "create_task"}
              onValueChange={(type) => {
                const p = getActionPrimitive(type);
                onUpdateAction(selectedNode.id, { type, config: p ? { ...p.defaultConfig } : {} });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_PRIMITIVES.map((p) => (
                  <SelectItem key={p.type} value={p.type}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {primitive && (
            <div className="space-y-2">
              <SectionLabel>Config</SectionLabel>
              <primitive.Form
                config={data.config ?? {}}
                onChange={(config) => onUpdateAction(selectedNode.id, { config })}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
        Unknown node type.
      </CardContent>
    </Card>
  );
}
