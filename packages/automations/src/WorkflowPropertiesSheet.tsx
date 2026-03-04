import { TrashIcon, CaretDownIcon, XIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "basics-os/src/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "basics-os/src/components/ui/collapsible";
import { topologicalSort } from "@basics-os/shared";
import { NodeConfigPanel } from "./NodeConfigPanel";
import type { WorkflowNode } from "./builderConstants";
import type { Edge } from "@xyflow/react";

function getWorkflowNodeOrder(nodes: WorkflowNode[], edges: Edge[]): string[] {
  const order = topologicalSort(
    nodes.map((n) => n.id),
    edges,
  );
  const remaining = nodes.map((n) => n.id).filter((id) => !order.includes(id));
  return [...order, ...remaining];
}

export interface WorkflowPropertiesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: WorkflowNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  expandedNodeIds: string[];
  onExpandedNodeIdsChange: (ids: string[]) => void;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  onReplaceNode: (
    nodeId: string,
    newType: string,
    newData: Record<string, unknown>,
  ) => void;
  onRequestDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onOpenSettings: () => void;
  nodeTypeLabels: Record<string, string>;
}

export function WorkflowPropertiesSheet({
  open,
  onOpenChange,
  nodes,
  edges,
  selectedNodeId,
  expandedNodeIds,
  onExpandedNodeIdsChange,
  onUpdateNode,
  onReplaceNode,
  onRequestDeleteNode,
  onDuplicateNode,
  onOpenSettings,
  nodeTypeLabels,
}: WorkflowPropertiesSheetProps) {
  const selectedRef = useRef<HTMLDivElement | null>(null);

  // When a node is selected, expand it
  useEffect(() => {
    if (selectedNodeId && !expandedNodeIds.includes(selectedNodeId)) {
      onExpandedNodeIdsChange([...expandedNodeIds, selectedNodeId]);
    }
  }, [selectedNodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll selected node into view whenever selection or panel visibility changes
  useEffect(() => {
    if (!selectedNodeId || !open) return;
    // Defer to let the DOM settle (panel may have just mounted or node just expanded)
    const id = requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedNodeId, open]);

  const setExpanded = useCallback(
    (nodeId: string, expanded: boolean) => {
      if (expanded) {
        onExpandedNodeIdsChange([...expandedNodeIds, nodeId]);
      } else {
        onExpandedNodeIdsChange(expandedNodeIds.filter((id) => id !== nodeId));
      }
    },
    [expandedNodeIds, onExpandedNodeIdsChange],
  );

  if (!open) return null;

  const orderedIds = getWorkflowNodeOrder(nodes, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const selectedNode = selectedNodeId
    ? (nodeMap.get(selectedNodeId) ?? null)
    : null;

  return (
    <div className="flex h-full w-[22rem] min-w-[22rem] max-w-[22rem] flex-none flex-col border-l border-border/60 bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-2.5">
        <span className="text-sm font-semibold tracking-tight">Workflow</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={() => onOpenChange(false)}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-2.5">
          {orderedIds.map((nodeId, index) => {
            const node = nodeMap.get(nodeId);
            if (!node) return null;
            const label = nodeTypeLabels[node.type ?? ""] ?? "Step";
            const isExpanded = expandedNodeIds.includes(nodeId);
            const isSelected = selectedNodeId === nodeId;
            return (
              <Collapsible
                key={nodeId}
                open={isExpanded}
                onOpenChange={(v: boolean) => setExpanded(nodeId, v)}
              >
                <div
                  ref={
                    isSelected
                      ? (el) => {
                          selectedRef.current = el;
                        }
                      : undefined
                  }
                  className={`overflow-hidden rounded-xl transition-all duration-200 ${
                    isSelected
                      ? "ring-1 ring-primary/40 shadow-sm shadow-primary/5"
                      : "ring-1 ring-border/50 hover:ring-border"
                  } ${isExpanded ? "bg-card/50" : "bg-muted/30 hover:bg-muted/40"}`}
                >
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-0.5 text-left transition-colors"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-background/80 text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="flex-1 text-sm font-medium truncate text-foreground/90">
                          {label}
                        </span>
                        <CaretDownIcon
                          className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete node"
                      onClick={() => onRequestDeleteNode(nodeId)}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                  <CollapsibleContent>
                    <div className="rounded-b-xl border-t border-border/30 bg-background/60 px-2.5 pb-2.5 pt-2.5">
                      <NodeConfigPanel
                        node={node}
                        onUpdate={(data) => onUpdateNode(nodeId, data)}
                        onReplaceNode={(newType, newData) =>
                          onReplaceNode(nodeId, newType, newData)
                        }
                        onOpenSettings={onOpenSettings}
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/40 bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {selectedNode ? (
          <div className="space-y-2">
            <p className="truncate text-xs text-muted-foreground">
              Selected:{" "}
              <span className="font-medium text-foreground">
                {nodeTypeLabels[selectedNode.type ?? ""] ?? "Step"}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                onClick={() => onDuplicateNode(selectedNode.id)}
              >
                Duplicate
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 px-3"
                onClick={() => onRequestDeleteNode(selectedNode.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select a step to edit or use quick actions.
          </p>
        )}
      </div>
    </div>
  );
}
