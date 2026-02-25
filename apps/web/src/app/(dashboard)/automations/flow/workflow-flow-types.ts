/**
 * Types and converters for the visual workflow (React Flow) ↔ automation API (triggerConfig + actionChain).
 * Keeps the flow UI a pure view over the existing automation model.
 */

import { Position, type Node, type Edge } from "@xyflow/react";

export const TRIGGER_NODE_ID = "trigger";

export type TriggerNodeData = {
  eventType: string;
  conditions: Array<{ field: string; operator: "eq" | "neq" | "gt" | "lt" | "contains"; value: string | number | boolean }>;
};

export type ActionNodeData = {
  type: string;
  config: Record<string, unknown>;
  label?: string;
};

export type WorkflowTriggerNode = Node<TriggerNodeData, "trigger">;
export type WorkflowActionNode = Node<ActionNodeData, "action">;
export type WorkflowNode = WorkflowTriggerNode | WorkflowActionNode;
export type WorkflowEdge = Edge;

export type AutomationFlow = {
  triggerConfig: { eventType: string; conditions: TriggerNodeData["conditions"] };
  actionChain: Array<{ type: string; config: Record<string, unknown> }>;
};

/** Build React Flow nodes and edges from automation API shape. */
export function flowFromAutomation(
  triggerConfig: AutomationFlow["triggerConfig"],
  actionChain: AutomationFlow["actionChain"],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  nodes.push({
    id: TRIGGER_NODE_ID,
    type: "trigger",
    position: { x: 0, y: 0 },
    data: {
      eventType: triggerConfig.eventType,
      conditions: triggerConfig.conditions ?? [],
    },
    sourcePosition: Position.Bottom,
  });

  const gapY = 120;
  let prevId: string = TRIGGER_NODE_ID;
  actionChain.forEach((action, i) => {
    const id = `action-${i}`;
    nodes.push({
      id,
      type: "action",
      position: { x: 0, y: 80 + (i + 1) * gapY },
      data: { type: action.type, config: action.config ?? {} },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    });
    edges.push({ id: `e-${prevId}-${id}`, source: prevId, target: id });
    prevId = id;
  });

  return { nodes, edges };
}

/** Extract triggerConfig + actionChain from React Flow nodes/edges (order = chain from trigger). */
export function flowToAutomation(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): AutomationFlow | null {
  const triggerNode = nodes.find((n) => n.id === TRIGGER_NODE_ID && n.type === "trigger") as WorkflowTriggerNode | undefined;
  if (!triggerNode?.data) return null;

  const outEdges = edges.filter((e) => e.source === TRIGGER_NODE_ID);
  const actionChain: AutomationFlow["actionChain"] = [];
  let currentId: string | null = outEdges[0]?.target ?? null;
  const seen = new Set<string>();

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const node = nodes.find((n) => n.id === currentId && n.type === "action") as WorkflowActionNode | undefined;
    if (!node?.data) break;
    actionChain.push({ type: node.data.type, config: node.data.config ?? {} });
    const nextEdge = edges.find((e) => e.source === currentId);
    currentId = nextEdge?.target ?? null;
  }

  return {
    triggerConfig: {
      eventType: triggerNode.data.eventType,
      conditions: triggerNode.data.conditions ?? [],
    },
    actionChain,
  };
}
