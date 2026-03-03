import { CaretLeftIcon, FloppyDiskIcon, CircleNotchIcon, PlayIcon, PlusIcon, LightningIcon, LinkIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import {
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MiniMap,
  Panel,
  type Edge,
  type Connection,
  ReactFlowProvider,
  useOnSelectionChange,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOne, create, update } from "basics-os/src/lib/api/crm";
import { fetchApi } from "basics-os/src/lib/api";
import { usePageTitle, usePageHeaderActions } from "basics-os/src/contexts/page-header";
import { Button } from "basics-os/src/components/ui/button";
import { Input } from "basics-os/src/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "basics-os/src/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "basics-os/src/components/ui/dialog";
import { Switch } from "basics-os/src/components/ui/switch";
import { WorkflowCanvas } from "basics-os/src/components/ai-elements/canvas";
import { WorkflowControls } from "basics-os/src/components/ai-elements/controls";
import { WorkflowConnection } from "basics-os/src/components/ai-elements/connection";
import { AutomationRunsPanel } from "./AutomationRunsPanel";
import { WorkflowPropertiesSheet } from "./WorkflowPropertiesSheet";
import { useAutomationConnections } from "./useAutomationConnections";
import { AutomationBuilderProvider } from "./AutomationBuilderContext";
import { NODE_TYPES, edgeTypes, newId, type WorkflowNode } from "./builderConstants";
import type { AutomationRule } from "./AutomationListPage";
import { toast } from "sonner";

type WorkflowEdgeType = Edge;

const NODE_TYPE_LABELS: Record<string, string> = {
  trigger: "Choose event",
  action: "Choose action",
  trigger_event: "Event trigger",
  trigger_schedule: "Schedule",
  action_email: "Send email",
  action_ai: "AI task",
  action_web_search: "Web search",
  action_crm: "CRM action",
  action_slack: "Slack message",
  action_gmail_read: "Read Gmail",
  action_gmail_send: "Send Gmail",
  action_ai_agent: "AI agent",
};

function BuilderInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === undefined || id === "create";
  const ruleId = isNew ? null : parseInt(id!, 10);

  const [name, setName] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [propertiesSheetOpen, setPropertiesSheetOpen] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const [deleteConfirmNodeId, setDeleteConfirmNodeId] = useState<string | null>(null);
  const [runsPanelOpen, setRunsPanelOpen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);

  const { connectedProviders } = useAutomationConnections();

  const { data: rule, isSuccess: ruleLoaded } = useQuery({
    queryKey: ["automation_rules", ruleId],
    queryFn: () => getOne<AutomationRule>("automation_rules", ruleId!),
    enabled: !!ruleId && !isNew,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdgeType>([]);
  const reactFlowInstance = useReactFlow<WorkflowNode, WorkflowEdgeType>();

  const [initialDef, setInitialDef] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) {
      setInitialDef(JSON.stringify({ nodes: [], edges: [], name: "" }));
      return;
    }
    if (!ruleLoaded || !rule) return;
    setName(rule.name ?? "");
    if (rule.workflowDefinition?.nodes?.length) {
      setNodes((rule.workflowDefinition.nodes as WorkflowNode[]).map((n) => ({ ...n, data: n.data ?? {} })));
    }
    if (rule.workflowDefinition?.edges?.length) {
      setEdges((rule.workflowDefinition.edges as WorkflowEdgeType[]).map((e) => ({ ...e, type: "animated" })));
    }
    setInitialDef(
      JSON.stringify({
        nodes: rule.workflowDefinition?.nodes ?? [],
        edges: rule.workflowDefinition?.edges ?? [],
        name: rule.name ?? "",
      })
    );
    if (ruleLoaded && rule?.workflowDefinition?.nodes?.length) {
      setPropertiesSheetOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, ruleLoaded, rule?.id]);

  const currentDef = JSON.stringify({
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    name,
  });
  const isDirty = initialDef !== null && currentDef !== initialDef;

  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes }) => {
      const nodeId = selectedNodes.length === 1 ? selectedNodes[0].id : null;
      setSelectedNodeId(nodeId);
      if (nodeId) {
        setPropertiesSheetOpen(true);
      }
    },
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: "animated" }, eds)),
    [setEdges]
  );

  const handleAddNode = useCallback(
    (type: WorkflowNode["type"], defaultData: Record<string, unknown>) => {
      const flowWrapper = document.querySelector(".react-flow");
      if (!flowWrapper || !reactFlowInstance.screenToFlowPosition) return;
      const rect = flowWrapper.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      position.x -= 56;
      position.y -= 56;
      const id = newId();
      setNodes((nds) => nds.concat({ id, type, position, data: { ...defaultData } }));
      setSelectedNodeId(id);
      setExpandedNodeIds((prev) => [...prev, id]);
      setPropertiesSheetOpen(true);
    },
    [setNodes, reactFlowInstance]
  );

  const handleDeleteNode = useCallback(() => {
    const nodeIdToDelete = deleteConfirmNodeId ?? selectedNodeId;
    if (!nodeIdToDelete) return;
    setNodes((nds) => nds.filter((n) => n.id !== nodeIdToDelete));
    setEdges((eds) => eds.filter((e) => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete));
    setSelectedNodeId((prev) => (prev === nodeIdToDelete ? null : prev));
    setExpandedNodeIds((prev) => prev.filter((id) => id !== nodeIdToDelete));
    setDeleteConfirmNodeId(null);
  }, [deleteConfirmNodeId, selectedNodeId, setNodes, setEdges]);

  const handleCloseDeleteConfirm = useCallback(() => {
    setDeleteConfirmNodeId(null);
  }, []);

  const createRule = useMutation({
    mutationFn: (data: { name: string; workflowDefinition: object; enabled: boolean }) =>
      create<AutomationRule>("automation_rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation_rules"] });
      toast.success("Automation saved");
      navigate("/automations");
    },
    onError: () => toast.error("Failed to save automation"),
  });

  const updateRule = useMutation({
    mutationFn: (data: { name?: string; workflowDefinition?: object; enabled?: boolean }) =>
      update<AutomationRule>("automation_rules", ruleId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation_rules"] });
      toast.success("Automation saved");
      setInitialDef(currentDef);
    },
    onError: () => toast.error("Failed to save automation"),
  });

  const runNowMutation = useMutation({
    mutationFn: () =>
      fetchApi<{ triggered: boolean }>("/api/automation-runs/run", {
        method: "POST",
        body: JSON.stringify({ ruleId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-runs", ruleId] });
      setRunsPanelOpen(true);
      toast.success("Run triggered");
    },
    onError: () => toast.error("Failed to trigger run"),
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      update<AutomationRule>("automation_rules", ruleId!, { enabled }),
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["automation_rules"] });
      toast.success(enabled ? "Automation enabled" : "Automation disabled");
    },
    onError: () => toast.error("Failed to update"),
  });

  const isSaving = createRule.isPending || updateRule.isPending;

  const onSave = useCallback(() => {
    const hasConfiguredTrigger = nodes.some((n) => n.type?.startsWith?.("trigger_"));
    if (!hasConfiguredTrigger) {
      toast.error("Add and configure an event before saving");
      return;
    }
    const hasUnconfigured = nodes.some((n) => n.type === "trigger" || n.type === "action");
    if (hasUnconfigured) {
      toast.error("Configure all nodes before saving");
      return;
    }
    const payload = {
      name: name.trim() || "Untitled Automation",
      workflowDefinition: {
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      },
      enabled: true,
    };
    if (isNew) createRule.mutate(payload);
    else updateRule.mutate({ ...payload, enabled: rule?.enabled ?? true });
  }, [nodes, edges, name, isNew, rule?.enabled, createRule, updateRule]);


  const updateNodeData = useCallback(
    (nodeId: string, dataUpdate: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...dataUpdate } } : n))
      );
    },
    [setNodes]
  );

  const replaceNode = useCallback(
    (nodeId: string, newType: string, newData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, type: newType, data: newData } : n))
      );
    },
    [setNodes]
  );

  usePageTitle(name || "New Automation");

  const headerActionsNode = useMemo(
    () => (
      <div className="flex items-center gap-2 w-full">
        <Button
          variant="ghost"
          size="sm"
          className="mr-auto gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/automations")}
        >
          <CaretLeftIcon className="size-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-52 border-0 bg-transparent px-0 font-medium focus-visible:ring-0"
            placeholder="Untitled Automation"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
          {isDirty && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">● Unsaved changes</span>
          )}
        </div>

        {!isNew && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => runNowMutation.mutate()}
              disabled={runNowMutation.isPending}
            >
              {runNowMutation.isPending ? (
                <CircleNotchIcon className="size-4 animate-spin" />
              ) : (
                <PlayIcon className="size-4" />
              )}
              Run now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setRunsPanelOpen(true)}
            >
              <PlayIcon className="size-4" />
              History
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Active</span>
              <Switch
                checked={rule?.enabled ?? false}
                onCheckedChange={(v: boolean) => toggleEnabledMutation.mutate(v)}
                disabled={toggleEnabledMutation.isPending}
              />
            </div>
          </>
        )}

        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground">
          <Link to="/settings#connections">
            <LinkIcon className="size-4" />
            Manage connections
          </Link>
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5">
          {isSaving ? <CircleNotchIcon className="size-4 animate-spin" /> : <FloppyDiskIcon className="size-4" />}
          Save
        </Button>
      </div>
    ),
    [name, isNew, isSaving, isDirty, rule, navigate, onSave, runNowMutation, toggleEnabledMutation],
  );
  const headerActionsPortal = usePageHeaderActions(headerActionsNode);

  return (
    <AutomationBuilderProvider
      value={{
        connectedProviders,
        nodes,
        edges,
        nodeTypeLabels: NODE_TYPE_LABELS,
      }}
    >
      <>
        {headerActionsPortal}
        <div className="flex min-h-0 flex-1 flex-col">
          <style>{`
            @keyframes workflow-dashdraw { to { stroke-dashoffset: -10; } }
          `}</style>

          <div className="relative flex flex-1 min-h-0">
            <div className="relative flex-1 min-w-0 bg-background">
              {nodes.length === 0 && (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Click <span className="font-medium text-foreground">+</span> to add your first step
                  </p>
                </div>
              )}
              <WorkflowCanvas
                connectionLineComponent={WorkflowConnection}
                connectionMode={ConnectionMode.Strict}
                edgeTypes={edgeTypes}
                edges={edges}
                nodes={nodes}
                onConnect={onConnect}
                onEdgesChange={onEdgesChange}
                onNodesChange={onNodesChange}
                nodeTypes={NODE_TYPES}
              >
                <Panel position="top-left" className="!m-4 !p-0 !border-0 !bg-transparent !rounded-none">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" className="h-10 w-10 rounded-full shadow-md" title="Add step">
                        <PlusIcon className="size-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleAddNode("trigger", {})}>
                        <PlayIcon className="size-4" />
                        Add Event
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddNode("action", {})}>
                        <LightningIcon className="size-4" />
                        Add Action
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Panel>
                <WorkflowControls showMinimap={showMinimap} onMinimapToggle={setShowMinimap} />
                {showMinimap && <MiniMap nodeStrokeWidth={3} position="bottom-right" />}
              </WorkflowCanvas>
            </div>

            <WorkflowPropertiesSheet
              open={propertiesSheetOpen && nodes.length > 0}
              onOpenChange={setPropertiesSheetOpen}
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              expandedNodeIds={expandedNodeIds}
              onExpandedNodeIdsChange={setExpandedNodeIds}
              onUpdateNode={updateNodeData}
              onReplaceNode={replaceNode}
              onRequestDeleteNode={setDeleteConfirmNodeId}
              onOpenSettings={() => navigate("/settings#connections")}
              nodeTypeLabels={NODE_TYPE_LABELS}
            />

            <Dialog open={deleteConfirmNodeId !== null} onOpenChange={(open: boolean) => !open && handleCloseDeleteConfirm()}>
              <DialogContent className="max-w-sm" showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Delete node?</DialogTitle>
                  <DialogDescription>
                    This will remove the node and its connections. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={handleCloseDeleteConfirm}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDeleteNode}>
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {ruleId && (
            <AutomationRunsPanel
              ruleId={runsPanelOpen ? ruleId : null}
              open={runsPanelOpen}
              onOpenChange={setRunsPanelOpen}
            />
          )}
        </div>
      </>
    </AutomationBuilderProvider>
  );
}

export function AutomationBuilderPage() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  );
}
