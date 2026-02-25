/**
 * Converts between persisted flow graph (nodes/edges) and execution shape (triggerConfig + actionChain).
 * Used by the API when saving from the visual editor: graph is source of truth; we derive triggerConfig
 * and actionChain so the existing executor (EventBus + BullMQ) keeps working unchanged.
 *
 * No React/React Flow dependency — safe to use in API.
 */

export const TRIGGER_NODE_ID = "trigger";

export type FlowNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
};

export type TriggerConfigFromFlow = {
  eventType: string;
  conditions: Array<{
    field: string;
    operator: "eq" | "neq" | "gt" | "lt" | "contains";
    value: string | number | boolean;
  }>;
};

export type ActionFromFlow = { type: string; config: Record<string, unknown> };

/**
 * Derive triggerConfig + actionChain from a flow graph.
 * Order of actions = chain from trigger (first outgoing edge → follow source→target until no next).
 */
export function flowToAutomation(
  nodes: FlowNode[],
  edges: FlowEdge[],
): { triggerConfig: TriggerConfigFromFlow; actionChain: ActionFromFlow[] } | null {
  const triggerNode = nodes.find((n) => n.id === TRIGGER_NODE_ID && n.type === "trigger");
  if (!triggerNode?.data) return null;

  const eventType = (triggerNode.data.eventType as string) ?? "task.created";
  const conditions = Array.isArray(triggerNode.data.conditions)
    ? (triggerNode.data.conditions as TriggerConfigFromFlow["conditions"])
    : [];

  const actionChain: ActionFromFlow[] = [];
  let currentId: string | null = edges.find((e) => e.source === TRIGGER_NODE_ID)?.target ?? null;
  const seen = new Set<string>();

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const node = nodes.find((n) => n.id === currentId && n.type === "action");
    if (!node?.data) break;
    actionChain.push({
      type: (node.data.type as string) ?? "create_task",
      config: (node.data.config as Record<string, unknown>) ?? {},
    });
    currentId = edges.find((e) => e.source === currentId)?.target ?? null;
  }

  return {
    triggerConfig: { eventType, conditions },
    actionChain,
  };
}
