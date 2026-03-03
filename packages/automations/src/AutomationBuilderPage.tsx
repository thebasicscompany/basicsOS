import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MiniMap,
  type Node,
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
import { Label } from "basics-os/src/components/ui/label";
import { Textarea } from "basics-os/src/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "basics-os/src/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "basics-os/src/components/ui/dropdown-menu";
import { Switch } from "basics-os/src/components/ui/switch";
import { WorkflowCanvas } from "basics-os/src/components/ai-elements/canvas";
import { WorkflowControls } from "basics-os/src/components/ai-elements/controls";
import { WorkflowConnection } from "basics-os/src/components/ai-elements/connection";
import { WorkflowEdge } from "basics-os/src/components/ai-elements/edge";
import { AutomationRunsPanel } from "./AutomationRunsPanel";
import type { AutomationRule } from "./AutomationListPage";
import {
  TriggerEventNode,
  TriggerScheduleNode,
  EmailActionNode,
  AIActionNode,
  WebSearchActionNode,
  CrmActionNode,
  SlackActionNode,
  AIAgentNode,
  GmailReadNode,
  GmailSendNode,
} from "./nodes";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Play, PlayCircle, Plus, Save, Trash2, X } from "lucide-react";

const NODE_TYPES = {
  trigger_event: TriggerEventNode,
  trigger_schedule: TriggerScheduleNode,
  action_email: EmailActionNode,
  action_ai: AIActionNode,
  action_web_search: WebSearchActionNode,
  action_crm: CrmActionNode,
  action_slack: SlackActionNode,
  action_ai_agent: AIAgentNode,
  action_gmail_read: GmailReadNode,
  action_gmail_send: GmailSendNode,
};

type WorkflowNode = Node<Record<string, unknown>, string>;
type WorkflowEdgeType = Edge;

const TRIGGER_ITEMS: { type: WorkflowNode["type"]; label: string; defaultData: Record<string, unknown> }[] = [
  { type: "trigger_event", label: "Event Trigger", defaultData: { event: "deal.created" } },
  { type: "trigger_schedule", label: "Schedule", defaultData: { cron: "0 9 * * 1", label: "Every Monday at 9am" } },
];

const ACTION_ITEMS: { type: WorkflowNode["type"]; label: string; defaultData: Record<string, unknown> }[] = [
  { type: "action_email", label: "Send Email", defaultData: { to: "", subject: "", body: "" } },
  { type: "action_ai", label: "AI Task", defaultData: { prompt: "" } },
  { type: "action_web_search", label: "Web Search", defaultData: { query: "", numResults: 5 } },
  { type: "action_crm", label: "CRM Action", defaultData: { action: "create_task", params: { text: "", type: "task", contactId: undefined } } },
  { type: "action_slack", label: "Send Slack Message", defaultData: { channel: "", message: "" } },
  { type: "action_gmail_read", label: "Read Gmail", defaultData: { query: "is:unread", maxResults: 5 } },
  { type: "action_gmail_send", label: "Send Gmail", defaultData: { to: "", subject: "", body: "" } },
  { type: "action_ai_agent", label: "AI Agent", defaultData: { objective: "", model: "", maxSteps: 6 } },
];

function newId() {
  return crypto.randomUUID().slice(0, 8);
}

const edgeTypes = { animated: WorkflowEdge.Animated };

function BuilderInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === undefined || id === "create";
  const ruleId = isNew ? null : parseInt(id!, 10);

  const [name, setName] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [runsPanelOpen, setRunsPanelOpen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);

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
    // Only reset when rule identity changes; setNodes/setEdges are stable
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
      if (nodeId) setPanelOpen(true);
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
      position.x -= 96;
      position.y -= 96;
      setNodes((nds) => nds.concat({ id: newId(), type, position, data: { ...defaultData } }));
    },
    [setNodes, reactFlowInstance]
  );

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    setPanelOpen(false);
  }, [selectedNodeId, setNodes, setEdges]);

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
    if (!nodes.some((n) => n.type?.startsWith?.("trigger_"))) {
      toast.error("Add a trigger node before saving");
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

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  const updateNodeData = useCallback(
    (nodeId: string, dataUpdate: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...dataUpdate } } : n))
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
          <ChevronLeft className="size-4" />
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="size-4" />
              Add node
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Triggers</DropdownMenuLabel>
            {TRIGGER_ITEMS.map((item) => (
              <DropdownMenuItem key={item.type} onClick={() => handleAddNode(item.type, item.defaultData)}>
                {item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {ACTION_ITEMS.map((item) => (
              <DropdownMenuItem key={item.type} onClick={() => handleAddNode(item.type, item.defaultData)}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PlayCircle className="size-4" />
              )}
              Run now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setRunsPanelOpen(true)}
            >
              <Play className="size-4" />
              History
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Active</span>
              <Switch
                checked={rule?.enabled ?? false}
                onCheckedChange={(v) => toggleEnabledMutation.mutate(v)}
                disabled={toggleEnabledMutation.isPending}
              />
            </div>
          </>
        )}

        <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5">
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save
        </Button>
      </div>
    ),
    [
      name,
      isNew,
      isSaving,
      isDirty,
      rule,
      navigate,
      onSave,
      handleAddNode,
      runNowMutation,
      toggleEnabledMutation,
    ],
  );
  const headerActionsPortal = usePageHeaderActions(headerActionsNode);

  return (
    <>
      {headerActionsPortal}
      <div className="flex min-h-0 flex-1 flex-col">
        <style>{`
          @keyframes workflow-dashdraw { to { stroke-dashoffset: -10; } }
        `}</style>

        {/* ── Canvas + Properties panel ────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div className="relative flex-1 min-w-0 bg-background">
          {/* Empty-canvas hint */}
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">No nodes yet</p>
              <p className="text-xs text-muted-foreground/70">Click "Add node" above to build your workflow</p>
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
            <WorkflowControls
              showMinimap={showMinimap}
              onMinimapToggle={setShowMinimap}
            />
            {showMinimap && <MiniMap nodeStrokeWidth={3} position="bottom-right" />}
          </WorkflowCanvas>
        </div>

        {/* Properties panel — only shown when a node is selected */}
        {panelOpen && selectedNode && (
          <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l bg-background">
            {/* Panel header */}
            <div className="flex h-14 shrink-0 items-center border-b px-4">
              <h2 className="flex-1 font-semibold">Properties</h2>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                title="Delete node"
                onClick={handleDeleteNode}
              >
                <Trash2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                title="Close"
                onClick={() => setPanelOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4">
              <ConfigPanel
                node={selectedNode}
                onUpdate={(data) => updateNodeData(selectedNode.id, data)}
              />
            </div>
          </div>
        )}
      </div>

        {/* Run history sheet */}
        {ruleId && (
          <AutomationRunsPanel
            ruleId={runsPanelOpen ? ruleId : null}
            open={runsPanelOpen}
            onOpenChange={setRunsPanelOpen}
          />
        )}
      </div>
    </>
  );
}

// ── Variable hint ──────────────────────────────────────────────────────────────

function VariableHint({ outputsAiResult, outputsWebResults }: { outputsAiResult?: boolean; outputsWebResults?: boolean }) {
  return (
    <div className="space-y-1 rounded-md bg-muted p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Available variables</p>
      <p><code className="font-mono">{"{{trigger_data}}"}</code> — full trigger payload</p>
      <p><code className="font-mono">{"{{trigger_data.name}}"}</code> — dot-path access</p>
      <p><code className="font-mono">{"{{sales_id}}"}</code> — current user ID</p>
      <p><code className="font-mono">{"{{ai_result}}"}</code> — output from AI node</p>
      <p><code className="font-mono">{"{{web_results}}"}</code> — output from Web Search node</p>
      {outputsAiResult && <p className="pt-1 font-medium text-foreground">Outputs: <code className="font-mono">{"{{ai_result}}"}</code></p>}
      {outputsWebResults && <p className="pt-1 font-medium text-foreground">Outputs: <code className="font-mono">{"{{web_results}}"}</code></p>}
    </div>
  );
}

// ── Config panel ───────────────────────────────────────────────────────────────

function ConfigPanel({
  node,
  onUpdate,
}: {
  node: WorkflowNode;
  onUpdate: (data: Record<string, unknown>) => void;
}) {
  const data = node.data ?? {};
  const type = node.type;

  if (type === "trigger_event") {
    const event = (data.event as string) || "deal.created";
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Event</Label>
          <Select value={event} onValueChange={(v: string) => onUpdate({ event: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deal.created">Deal created</SelectItem>
              <SelectItem value="deal.updated">Deal updated</SelectItem>
              <SelectItem value="deal.deleted">Deal deleted</SelectItem>
              <SelectItem value="contact.created">Contact created</SelectItem>
              <SelectItem value="contact.updated">Contact updated</SelectItem>
              <SelectItem value="task.created">Task created</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (type === "trigger_schedule") {
    const cron = (data.cron as string) || "";
    const label = (data.label as string) || "";
    const presets = [
      { cron: "0 * * * *", label: "Hourly" },
      { cron: "0 9 * * *", label: "Daily at 9am" },
      { cron: "0 9 * * 1", label: "Every Monday at 9am" },
    ];
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Preset</Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.cron}
                size="sm"
                variant={cron === p.cron ? "default" : "outline"}
                onClick={() => onUpdate({ cron: p.cron, label: p.label })}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Cron expression</Label>
          <Input
            value={cron}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ cron: e.target.value })}
            placeholder="0 9 * * 1"
          />
        </div>
        <div className="space-y-2">
          <Label>Label</Label>
          <Input
            value={label}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ label: e.target.value })}
            placeholder="Every Monday at 9am"
          />
        </div>
      </div>
    );
  }

  if (type === "action_email") {
    const to = (data.to as string) || "";
    const subject = (data.subject as string) || "";
    const body = (data.body as string) || "";
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>To</Label>
          <Input
            type="email"
            value={to}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ to: e.target.value })}
            placeholder="email@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input
            value={subject}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ subject: e.target.value })}
            placeholder="New deal: {{trigger_data.name}}"
          />
        </div>
        <div className="space-y-2">
          <Label>Body</Label>
          <Textarea
            value={body}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ body: e.target.value })}
            placeholder="{{ai_result}}"
            rows={4}
          />
        </div>
        <VariableHint />
      </div>
    );
  }

  if (type === "action_ai") {
    const prompt = (data.prompt as string) || "";
    const model = (data.model as string) || "";
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ prompt: e.target.value })}
            placeholder="Summarize {{trigger_data}}"
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label>Model (optional)</Label>
          <Input
            value={model}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ model: e.target.value })}
            placeholder="default"
          />
        </div>
        <VariableHint outputsAiResult />
      </div>
    );
  }

  if (type === "action_web_search") {
    const query = (data.query as string) || "";
    const numResults = (data.numResults as number) ?? 5;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Query</Label>
          <Input
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ query: e.target.value })}
            placeholder="Use {{variables}}"
          />
        </div>
        <div className="space-y-2">
          <Label>Num results (1–10)</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={numResults}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onUpdate({ numResults: parseInt(e.target.value, 10) || 5 })
            }
          />
        </div>
        <VariableHint outputsWebResults />
      </div>
    );
  }

  if (type === "action_crm") {
    const action = (data.action as string) || "create_task";
    const params = (data.params as Record<string, unknown>) ?? {};
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Action</Label>
          <Select value={action} onValueChange={(v: string) => onUpdate({ action: v, params: {} })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="create_task">Create task</SelectItem>
              <SelectItem value="create_contact">Create contact</SelectItem>
              <SelectItem value="create_note">Create note</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {action === "create_task" && (
          <>
            <div className="space-y-2">
              <Label>Task text</Label>
              <Input
                value={(params.text as string) ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onUpdate({ params: { ...params, text: e.target.value } })
                }
                placeholder="Follow up with {{trigger_data.name}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input
                value={(params.type as string) ?? "Todo"}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onUpdate({ params: { ...params, type: e.target.value } })
                }
                placeholder="Todo"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact ID</Label>
              <Input
                value={(params.contactId as string) ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onUpdate({ params: { ...params, contactId: e.target.value } })
                }
                placeholder="{{trigger_data.contactId}}"
              />
            </div>
          </>
        )}

        {action === "create_contact" && (
          <>
            <div className="space-y-2">
              <Label>First name</Label>
              <Input
                value={(params.firstName as string) ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onUpdate({ params: { ...params, firstName: e.target.value } })
                }
                placeholder="{{trigger_data.first_name}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input
                value={(params.lastName as string) ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onUpdate({ params: { ...params, lastName: e.target.value } })
                }
                placeholder="{{trigger_data.last_name}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={(params.email as string) ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onUpdate({ params: { ...params, email: e.target.value } })
                }
                placeholder="{{trigger_data.email}}"
              />
            </div>
          </>
        )}

        {action === "create_note" && (
          <>
            <div className="space-y-2">
              <Label>Contact ID</Label>
              <Input
                value={(params.contactId as string) ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onUpdate({ params: { ...params, contactId: e.target.value } })
                }
                placeholder="{{trigger_data.contactId}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Note text</Label>
              <Textarea
                value={(params.text as string) ?? ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  onUpdate({ params: { ...params, text: e.target.value } })
                }
                placeholder="{{ai_result}}"
                rows={4}
              />
            </div>
          </>
        )}

        <div className="space-y-1 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Outputs: <code className="font-mono">{"{{crm_result}}"}</code></p>
        </div>
        <VariableHint />
      </div>
    );
  }

  if (type === "action_slack") {
    const channel = (data.channel as string) || "";
    const message = (data.message as string) || "";
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Channel</Label>
          <Input
            value={channel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ channel: e.target.value })}
            placeholder="#general or @username"
          />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ message: e.target.value })}
            placeholder="New deal: {{trigger_data.name}}"
            rows={4}
          />
        </div>
        <VariableHint />
      </div>
    );
  }

  if (type === "action_gmail_read") {
    const query = (data.query as string) || "is:unread";
    const maxResults = (data.maxResults as number) ?? 5;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Query</Label>
          <Input
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ query: e.target.value })}
            placeholder="is:unread from:boss@company.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Max results</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={maxResults}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onUpdate({ maxResults: parseInt(e.target.value, 10) || 5 })
            }
          />
        </div>
        <div className="space-y-1 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Outputs: <code className="font-mono">{"{{gmail_messages}}"}</code></p>
        </div>
      </div>
    );
  }

  if (type === "action_gmail_send") {
    const to = (data.to as string) || "";
    const subject = (data.subject as string) || "";
    const body = (data.body as string) || "";
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>To</Label>
          <Input
            value={to}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ to: e.target.value })}
            placeholder="recipient@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input
            value={subject}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ subject: e.target.value })}
            placeholder="Update: {{trigger_data.name}}"
          />
        </div>
        <div className="space-y-2">
          <Label>Body</Label>
          <Textarea
            value={body}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ body: e.target.value })}
            placeholder="{{ai_result}}"
            rows={4}
          />
        </div>
        <VariableHint />
      </div>
    );
  }

  if (type === "action_ai_agent") {
    const objective = (data.objective as string) || "";
    const maxSteps = (data.maxSteps as number) ?? 6;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Objective</Label>
          <Textarea
            value={objective}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ objective: e.target.value })}
            placeholder="Find contacts from {{trigger_data.company}} and create a follow-up task"
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label>Max steps</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={maxSteps}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onUpdate({ maxSteps: parseInt(e.target.value, 10) || 6 })
            }
          />
        </div>
        <div className="space-y-1 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Outputs: <code className="font-mono">{"{{ai_agent_result}}"}</code></p>
          <p>The agent has access to CRM tools: search contacts, deals, create tasks, update deals.</p>
        </div>
        <VariableHint />
      </div>
    );
  }

  return null;
}

// ── Export ─────────────────────────────────────────────────────────────────────

export function AutomationBuilderPage() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  );
}
