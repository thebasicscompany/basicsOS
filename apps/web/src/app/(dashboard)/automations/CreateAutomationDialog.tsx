"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Textarea,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  Badge,
  addToast,
  Sparkles,
  Plus,
  SectionLabel,
  Briefcase,
  Trophy,
  XCircle,
  Users,
  Building2,
  ArrowRight,
} from "@basicsos/ui";
import type { InsertAutomation } from "@basicsos/shared";
import { ActionBuilder } from "./ActionBuilder";
import type { ActionConfig } from "./action-primitives/index";
import { getTriggerLabel } from "./trigger-meta";

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_task: "Create Task",
  call_webhook: "Call Webhook",
  run_ai_prompt: "Run AI Prompt",
  update_crm: "Update CRM",
  send_email: "Send Email",
  post_slack: "Post to Slack",
};

type ParsedSpec = Omit<InsertAutomation, "tenantId">;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export const CreateAutomationDialog = ({ open, onOpenChange, onCreated }: Props): JSX.Element => {
  const utils = trpc.useUtils();

  // AI tab state
  const [description, setDescription] = useState("");
  const [parsedSpec, setParsedSpec] = useState<ParsedSpec | null>(null);
  const [aiStep, setAiStep] = useState<"input" | "preview">("input");

  // Manual tab state
  const [manualName, setManualName] = useState("");
  const [manualEventType, setManualEventType] = useState("");
  const [manualStageFilter, setManualStageFilter] = useState("");
  const [manualActions, setManualActions] = useState<Array<{ type: string; config: ActionConfig }>>([]);

  const parseFromDescription = trpc.automations.parseFromDescription.useMutation({
    onSuccess: (spec) => {
      setParsedSpec(spec as ParsedSpec);
      setAiStep("preview");
    },
    onError: (err) => {
      addToast({ title: "Could not parse automation", description: err.message, variant: "destructive" });
    },
  });

  const createFromParsed = trpc.automations.createFromParsed.useMutation({
    onSuccess: () => {
      addToast({ title: "Automation created", variant: "success" });
      void utils.automations.list.invalidate();
      onCreated();
      handleClose();
    },
    onError: (err) => {
      addToast({ title: "Failed to save automation", description: err.message, variant: "destructive" });
    },
  });

  const createManual = trpc.automations.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Automation created", variant: "success" });
      void utils.automations.list.invalidate();
      onCreated();
      handleClose();
    },
    onError: (err) => {
      addToast({ title: "Failed to create automation", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = (): void => {
    setDescription("");
    setParsedSpec(null);
    setAiStep("input");
    setManualName("");
    setManualEventType("");
    setManualStageFilter("");
    setManualActions([]);
    onOpenChange(false);
  };

  const handleGeneratePreview = (): void => {
    if (description.trim().length < 10) return;
    parseFromDescription.mutate({ description: description.trim() });
  };

  const handleSaveFromAi = (): void => {
    if (!parsedSpec) return;
    createFromParsed.mutate(parsedSpec);
  };

  const handleSaveManual = (): void => {
    if (!manualName.trim() || !manualEventType) return;
    const conditions: Array<{ field: string; operator: "eq" | "neq" | "gt" | "lt" | "contains"; value: string | number | boolean }> =
      manualEventType === "crm.deal.stage_changed" && manualStageFilter.trim()
        ? [{ field: "toStage", operator: "eq", value: manualStageFilter.trim() }]
        : [];
    createManual.mutate({
      name: manualName.trim(),
      triggerConfig: { eventType: manualEventType, conditions },
      actionChain: manualActions as Array<{ type: "create_task" | "call_webhook" | "run_ai_prompt" | "send_email" | "update_crm" | "post_slack"; config: Record<string, unknown> }>,
      enabled: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Automation</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ai">
          <TabsList className="w-full">
            <TabsTrigger value="ai" className="flex-1">
              <Sparkles size={14} className="mr-1.5" /> Describe it
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
          </TabsList>

          {/* AI tab — two-step: describe → preview → save */}
          <TabsContent value="ai" className="mt-4 space-y-4">
            {aiStep === "input" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-desc">Describe what you want to automate</Label>
                  <Textarea
                    id="ai-desc"
                    placeholder="e.g. When a deal is won, create a follow-up task and call our webhook"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <p className="text-xs text-stone-400 dark:text-stone-500">
                    Mention the trigger (when X happens) and the actions (do Y, then Z).
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleClose}>Cancel</Button>
                  <Button
                    onClick={handleGeneratePreview}
                    disabled={description.trim().length < 10 || parseFromDescription.isPending}
                  >
                    {parseFromDescription.isPending ? "Parsing…" : "Generate Preview"}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              parsedSpec && (
                <>
                  <div className="rounded-lg border border-border bg-muted p-4 space-y-3">
                    <div>
                      <SectionLabel className="mb-1">Name</SectionLabel>
                      <p className="font-medium text-stone-900 dark:text-stone-100">{parsedSpec.name}</p>
                    </div>
                    <div>
                      <SectionLabel className="mb-1">Trigger</SectionLabel>
                      <Badge variant="secondary">{getTriggerLabel(parsedSpec.triggerConfig.eventType)}</Badge>
                    </div>
                    <div>
                      <SectionLabel className="mb-1">
                        Actions ({parsedSpec.actionChain.length})
                      </SectionLabel>
                      <div className="space-y-1">
                        {parsedSpec.actionChain.map((action, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                            <span className="text-stone-400 dark:text-stone-500">{i + 1}.</span>
                            <span>{ACTION_TYPE_LABELS[action.type] ?? action.type}</span>
                          </div>
                        ))}
                        {parsedSpec.actionChain.length === 0 && (
                          <p className="text-sm text-stone-400 dark:text-stone-500 italic">No actions — you can add them after saving.</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAiStep("input")}>
                      ← Back
                    </Button>
                    <Button
                      onClick={handleSaveFromAi}
                      disabled={createFromParsed.isPending}
                    >
                      {createFromParsed.isPending ? "Saving…" : "Save Automation"}
                    </Button>
                  </DialogFooter>
                </>
              )
            )}
          </TabsContent>

          {/* Manual tab — name + trigger only (actions can be added later) */}
          <TabsContent value="manual" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="manual-name">Automation Name</Label>
              <Input
                id="manual-name"
                placeholder="e.g. Deal Won Follow-up"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Trigger Event</Label>
              <Select value={manualEventType} onValueChange={(v) => { setManualEventType(v); setManualStageFilter(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a trigger…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="flex items-center gap-1.5">
                      <Briefcase size={12} /> CRM
                    </SelectLabel>
                    <SelectItem value="crm.deal.stage_changed">
                      <span className="flex items-center gap-2">
                        <ArrowRight size={14} className="text-stone-400" /> Deal Stage Changed
                      </span>
                    </SelectItem>
                    <SelectItem value="crm.deal.won">
                      <span className="flex items-center gap-2">
                        <Trophy size={14} className="text-stone-400" /> Deal Won
                      </span>
                    </SelectItem>
                    <SelectItem value="crm.deal.lost">
                      <span className="flex items-center gap-2">
                        <XCircle size={14} className="text-stone-400" /> Deal Lost
                      </span>
                    </SelectItem>
                    <SelectItem value="crm.contact.created">
                      <span className="flex items-center gap-2">
                        <Users size={14} className="text-stone-400" /> Contact Created
                      </span>
                    </SelectItem>
                    <SelectItem value="crm.company.created">
                      <span className="flex items-center gap-2">
                        <Building2 size={14} className="text-stone-400" /> Company Created
                      </span>
                    </SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Tasks</SelectLabel>
                    <SelectItem value="task.created">Task Created</SelectItem>
                    <SelectItem value="task.completed">Task Completed</SelectItem>
                    <SelectItem value="task.assigned">Task Assigned</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Meetings</SelectLabel>
                    <SelectItem value="meeting.ended">Meeting Ended</SelectItem>
                    <SelectItem value="meeting.summary.generated">Meeting Summary Ready</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Documents</SelectLabel>
                    <SelectItem value="document.created">Document Created</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Stage filter — shown only when crm.deal.stage_changed is selected */}
            {manualEventType === "crm.deal.stage_changed" && (
              <div className="space-y-1.5">
                <Label htmlFor="stage-filter">When stage changes to (optional)</Label>
                <Input
                  id="stage-filter"
                  placeholder="e.g. won, proposal, qualified…"
                  value={manualStageFilter}
                  onChange={(e) => setManualStageFilter(e.target.value)}
                />
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  Leave blank to trigger on any stage change.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Actions</Label>
              <ActionBuilder actions={manualActions} onChange={setManualActions} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleSaveManual}
                disabled={!manualName.trim() || !manualEventType || createManual.isPending}
              >
                {createManual.isPending ? "Creating…" : "Create Automation"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
