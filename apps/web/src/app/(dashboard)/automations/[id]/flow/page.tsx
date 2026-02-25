"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type NodeTypes,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Input,
  addToast,
  ArrowLeft,
  Plus,
  Check,
} from "@basicsos/ui";
import { TriggerNode } from "../../flow/nodes/TriggerNode";
import { ActionNode } from "../../flow/nodes/ActionNode";
import { FlowConfigPanel } from "../../flow/FlowConfigPanel";
import {
  flowFromAutomation,
  flowToAutomation,
  TRIGGER_NODE_ID,
  type WorkflowNode,
  type WorkflowEdge,
  type AutomationFlow,
  type TriggerNodeData,
  type ActionNodeData,
} from "../../flow/workflow-flow-types";

const nodeTypes = { trigger: TriggerNode, action: ActionNode };

function FlowEditorInner({ automationId }: { automationId: string }): JSX.Element {
  const utils = trpc.useUtils();
  const hasInitialized = useRef(false);

  const { data: automation, isLoading } = trpc.automations.get.useQuery({ id: automationId });
  const updateMutation = trpc.automations.update.useMutation({
    onSuccess: () => {
      addToast({ title: "Saved", variant: "success" });
      void utils.automations.get.invalidate({ id: automationId });
    },
    onError: (err) => addToast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const flowNodes = automation?.flowNodes as Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }> | null;
  const flowEdges = automation?.flowEdges as Array<{ id: string; source: string; target: string }> | null;

  useEffect(() => {
    if (!automation || hasInitialized.current) return;
    hasInitialized.current = true;
    setName(automation.name);
    if (flowNodes?.length && flowEdges?.length) {
      setNodes(flowNodes as WorkflowNode[]);
      setEdges(flowEdges as WorkflowEdge[]);
    } else {
      const triggerConfig = automation.triggerConfig as AutomationFlow["triggerConfig"];
      const actionChain = Array.isArray(automation.actionChain) ? automation.actionChain : [];
      const { nodes: n, edges: e } = flowFromAutomation(triggerConfig, actionChain);
      setNodes(n);
      setEdges(e);
    }
  }, [automation, flowNodes, flowEdges, setNodes, setEdges]);

  useEffect(() => {
    if (automation?.name && !name) setName(automation.name);
  }, [automation?.name, name]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId],
  ) as Node<WorkflowNode["data"]> | null;

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const onUpdateTrigger = useCallback(
    (data: Partial<TriggerNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === TRIGGER_NODE_ID
            ? ({ ...n, data: { ...n.data, ...data } as TriggerNodeData } as WorkflowNode)
            : n,
        ),
      );
    },
    [setNodes],
  );

  const onUpdateAction = useCallback(
    (nodeId: string, data: Partial<ActionNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? ({ ...n, data: { ...n.data, ...data } as ActionNodeData } as WorkflowNode)
            : n,
        ),
      );
    },
    [setNodes],
  );

  const handleAddAction = useCallback(() => {
    const actionNodes = nodes.filter((n) => n.type === "action");
    const nextIndex = actionNodes.length;
    const lastId = nextIndex === 0 ? TRIGGER_NODE_ID : `action-${nextIndex - 1}`;
    const newNodeId = `action-${nextIndex}`;
    const lastNode = nodes.find((n) => n.id === lastId);
    const gapY = 120;
    const newPosition = lastNode
      ? { x: lastNode.position.x, y: lastNode.position.y + gapY }
      : { x: 0, y: 200 };
    setNodes((nds) => [
      ...nds,
      {
        id: newNodeId,
        type: "action",
        position: newPosition,
        data: { type: "create_task", config: { title: "", priority: "medium", description: "" } },
        targetPosition: "top",
        sourcePosition: "bottom",
      } as WorkflowNode,
    ]);
    setEdges((eds) => [
      ...eds,
      { id: `e-${lastId}-${newNodeId}`, source: lastId, target: newNodeId },
    ]);
    setSelectedNodeId(newNodeId);
  }, [nodes, setNodes, setEdges]);

  const handleSave = useCallback(() => {
    const derived = flowToAutomation(nodes, edges);
    if (!derived) {
      addToast({ title: "Invalid flow", description: "Need a trigger node.", variant: "destructive" });
      return;
    }
    const flowNodesPayload = nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "action",
      position: n.position,
      data: n.data ?? {},
    }));
    const flowEdgesPayload = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
    updateMutation.mutate({
      id: automationId,
      name: name.trim() || automation?.name,
      flowNodes: flowNodesPayload,
      flowEdges: flowEdgesPayload,
    });
  }, [automationId, automation?.name, name, nodes, edges, updateMutation]);

  if (isLoading || !automation) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-stone-500 dark:text-stone-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b border-stone-200 dark:border-stone-800 px-4 py-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/automations/${automationId}`}>
            <ArrowLeft size={14} className="mr-1" /> Back
          </Link>
        </Button>
        <Input
          className="max-w-xs"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Automation name"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateMutation.isPending || !flowToAutomation(nodes, edges)}
        >
          <Check size={14} className="mr-1" /> {updateMutation.isPending ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleAddAction}>
          <Plus size={14} className="mr-1" /> Add action
        </Button>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes as NodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            deleteKeyCode={["Backspace", "Delete"]}
            connectionLineStyle={{ stroke: "var(--color-primary)" }}
          >
            <Background gap={24} size={2} color="var(--stone-200)" />
            <Controls
              className="!bg-stone-100 !border-stone-200 dark:!bg-stone-800 dark:!border-stone-700 [&>button]:!bg-transparent [&>button]:!border-stone-300 [&>button]:!text-stone-700 dark:[&>button]:!border-stone-600 dark:[&>button]:!text-stone-300 [&>button:hover]:!bg-stone-200 dark:[&>button:hover]:!bg-stone-700"
            />
          </ReactFlow>
        </div>
        <aside className="w-80 shrink-0 border-l border-stone-200 dark:border-stone-800 overflow-y-auto p-4">
          <FlowConfigPanel
            selectedNode={selectedNode as Node<TriggerNodeData, "trigger"> | Node<ActionNodeData, "action"> | null}
            onUpdateTrigger={onUpdateTrigger}
            onUpdateAction={onUpdateAction}
          />
        </aside>
      </div>
    </div>
  );
}

export default function AutomationFlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  return (
    <ReactFlowProvider>
      <FlowEditorInner automationId={id} />
    </ReactFlowProvider>
  );
}
