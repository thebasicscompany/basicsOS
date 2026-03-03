import { useMemo } from "react";
import { topologicalSort } from "@basics-os/shared";
import type { Edge } from "@xyflow/react";
import type { WorkflowNode } from "./builderConstants";

export interface Variable {
  name: string;
  label: string;
  sourceNodeId: string;
  sourceNodeType: string;
  sourceLabel: string;
}

const NODE_TYPE_LABELS: Record<string, string> = {
  trigger_event: "Event trigger",
  trigger_schedule: "Schedule",
  action_ai: "AI task",
  action_web_search: "Web search",
  action_crm: "CRM action",
  action_gmail_read: "Read Gmail",
  action_ai_agent: "AI agent",
};

function getVariablesForNodeType(
  nodeId: string,
  nodeType: string,
  label: string
): Variable[] {
  const base: Variable[] = [];
  switch (nodeType) {
    case "trigger_event":
    case "trigger_schedule":
      base.push(
        { name: "trigger_data", label: "{{trigger_data}}", sourceNodeId: nodeId, sourceNodeType: nodeType, sourceLabel: label },
        { name: "trigger_data.*", label: "{{trigger_data.*}}", sourceNodeId: nodeId, sourceNodeType: nodeType, sourceLabel: label }
      );
      break;
    case "action_ai":
      base.push({ name: "ai_result", label: "{{ai_result}}", sourceNodeId: nodeId, sourceNodeType: nodeType, sourceLabel: label });
      break;
    case "action_web_search":
      base.push({ name: "web_results", label: "{{web_results}}", sourceNodeId: nodeId, sourceNodeType: nodeType, sourceLabel: label });
      break;
    case "action_crm":
      base.push({ name: "crm_result", label: "{{crm_result}}", sourceNodeId: nodeId, sourceNodeType: nodeType, sourceLabel: label });
      break;
    case "action_gmail_read":
      base.push({ name: "gmail_messages", label: "{{gmail_messages}}", sourceNodeId: nodeId, sourceNodeType: nodeType, sourceLabel: label });
      break;
    case "action_ai_agent":
      base.push({ name: "ai_agent_result", label: "{{ai_agent_result}}", sourceNodeId: nodeId, sourceNodeType: nodeType, sourceLabel: label });
      break;
  }
  return base;
}

function getAncestorOrder(nodeId: string, nodes: WorkflowNode[], edges: Edge[]): string[] {
  const order = topologicalSort(
    nodes.map((n) => n.id),
    edges,
  );
  const remaining = nodes.map((n) => n.id).filter((id) => !order.includes(id));
  const fullOrder = [...order, ...remaining];
  const idx = fullOrder.indexOf(nodeId);
  return idx < 0 ? [] : fullOrder.slice(0, idx);
}

export function useAvailableVariables(
  nodeId: string | null,
  nodes: WorkflowNode[],
  edges: Edge[],
  nodeTypeLabels?: Record<string, string>
): Variable[] {
  return useMemo(() => {
    if (!nodeId || nodes.length === 0) return [];

    const labels = nodeTypeLabels ?? NODE_TYPE_LABELS;
    const ancestorIds = getAncestorOrder(nodeId, nodes, edges);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const variables: Variable[] = [];

    for (const aid of ancestorIds) {
      const node = nodeMap.get(aid);
      if (!node?.type) continue;
      const sourceLabel = labels[node.type] ?? node.type;
      const vars = getVariablesForNodeType(aid, node.type, sourceLabel);
      variables.push(...vars);
    }

    variables.push({
      name: "sales_id",
      label: "{{sales_id}}",
      sourceNodeId: "",
      sourceNodeType: "global",
      sourceLabel: "Global",
    });

    return variables;
  }, [nodeId, nodes, edges, nodeTypeLabels]);
}
