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
  Badge,
  addToast,
  Sparkles,
  Plus,
  SectionLabel,
} from "@basicsos/ui";
import type { InsertAutomation } from "@basicsos/shared";
import { ActionBuilder } from "./ActionBuilder";
import type { ActionConfig } from "./action-primitives/index";

const TRIGGER_EVENT_TYPES = [
  { value: "task.created", label: "Task Created" },
  { value: "task.completed", label: "Task Completed" },
  { value: "task.assigned", label: "Task Assigned" },
  { value: "crm.deal.stage_changed", label: "Deal Stage Changed" },
  { value: "crm.deal.won", label: "Deal Won" },
  { value: "crm.deal.lost", label: "Deal Lost" },
  { value: "crm.contact.created", label: "Contact Created" },
  { value: "meeting.ended", label: "Meeting Ended" },
  { value: "meeting.summary.generated", label: "Meeting Summary Ready" },
  { value: "document.created", label: "Document Created" },
];

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
    createManual.mutate({
      name: manualName.trim(),
      triggerConfig: { eventType: manualEventType, conditions: [] },
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
                      <Badge variant="secondary">{parsedSpec.triggerConfig.eventType}</Badge>
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
              <Select value={manualEventType} onValueChange={setManualEventType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a trigger…" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENT_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
