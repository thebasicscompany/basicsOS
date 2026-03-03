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
  onReplaceNode: (nodeId: string, newType: string, newData: Record<string, unknown>) => void;
  onRequestDeleteNode: (nodeId: string) => void;
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
      selectedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    [expandedNodeIds, onExpandedNodeIdsChange]
  );

  if (!open) return null;

  const orderedIds = getWorkflowNodeOrder(nodes, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="w-80 shrink-0 flex flex-col border-l border-border/60 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
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
      <div className="flex-1 overflow-y-auto pl-6 pr-4 pt-6 pb-6">
        <div className="flex flex-col gap-3">
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
                  ref={isSelected ? (el) => { selectedRef.current = el; } : undefined}
                  className={`overflow-hidden rounded-xl transition-all duration-200 ${
                    isSelected
                      ? "ring-1 ring-primary/40 shadow-sm shadow-primary/5"
                      : "ring-1 ring-border/50 hover:ring-border"
                  } ${isExpanded ? "bg-card/50" : "bg-muted/30 hover:bg-muted/40"}`}
                >
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-2.5 min-w-0 text-left rounded-lg transition-colors py-0.5"
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
                  <div className="border-t border-border/30 bg-background/60 rounded-b-xl px-4 pt-4 pb-4">
                    <NodeConfigPanel
                      node={node}
                      onUpdate={(data) => onUpdateNode(nodeId, data)}
                      onReplaceNode={(newType, newData) => onReplaceNode(nodeId, newType, newData)}
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
    </div>
  );
}
