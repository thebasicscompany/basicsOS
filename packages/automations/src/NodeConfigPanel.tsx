import { CaretDownIcon } from "@phosphor-icons/react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "basics-os/src/components/ui/collapsible";
import { useAutomationBuilder } from "./AutomationBuilderContext";
import type { WorkflowNode } from "./builderConstants";

function VariableHint({
  outputsAiResult,
  outputsWebResults,
}: {
  outputsAiResult?: boolean;
  outputsWebResults?: boolean;
}) {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md bg-muted px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/80">
        Available variables
        <CaretDownIcon className="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <p><code className="font-mono">{"{{trigger_data}}"}</code> — full trigger payload</p>
          <p><code className="font-mono">{"{{trigger_data.name}}"}</code> — dot-path access</p>
          <p><code className="font-mono">{"{{sales_id}}"}</code> — current user ID</p>
          <p><code className="font-mono">{"{{ai_result}}"}</code> — output from AI node</p>
          <p><code className="font-mono">{"{{web_results}}"}</code> — output from Web Search node</p>
          {outputsAiResult && <p className="pt-1 font-medium text-foreground">Outputs: <code className="font-mono">{"{{ai_result}}"}</code></p>}
          {outputsWebResults && <p className="pt-1 font-medium text-foreground">Outputs: <code className="font-mono">{"{{web_results}}"}</code></p>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ConnectionRequiredBanner({
  provider,
  onOpenSettings,
}: {
  provider: string;
  onOpenSettings: () => void;
}) {
  const label = provider === "slack" ? "Slack" : provider === "google" ? "Gmail" : provider;
  return (
    <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
      <p className="font-medium text-amber-800 dark:text-amber-200">
        Connect {label} to run this step
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Connect {label} in Settings to use this action.
      </p>
      <Button variant="outline" size="sm" className="mt-2" onClick={onOpenSettings}>
        Connect in Settings
      </Button>
    </div>
  );
}

export interface NodeConfigPanelProps {
  node: WorkflowNode;
  onUpdate: (data: Record<string, unknown>) => void;
  onReplaceNode?: (newType: string, newData: Record<string, unknown>) => void;
  onOpenSettings?: () => void;
}

export function NodeConfigPanel({
  node,
  onUpdate,
  onReplaceNode,
  onOpenSettings,
}: NodeConfigPanelProps) {
  const data = node.data ?? {};
  const type = node.type;
  const { connectedProviders } = useAutomationBuilder();

  if (type === "trigger") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Event type</Label>
          <Select
            onValueChange={(v) => {
              if (v === "trigger_event") {
                onReplaceNode?.("trigger_event", { event: "deal.created" });
              } else if (v === "trigger_schedule") {
                onReplaceNode?.("trigger_schedule", { cron: "0 9 * * 1", label: "Every Monday at 9am" });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose event type…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trigger_event">Event (deal, contact, task)</SelectItem>
              <SelectItem value="trigger_schedule">Schedule (cron)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (type === "action") {
    const actionTypes = [
      { value: "action_email", label: "Send Email", data: { to: "", subject: "", body: "" } },
      { value: "action_ai", label: "AI Task", data: { prompt: "" } },
      { value: "action_web_search", label: "Web Search", data: { query: "", numResults: 5 } },
      { value: "action_crm", label: "CRM Action", data: { action: "create_task", params: { text: "", type: "task", contactId: undefined } } },
      { value: "action_slack", label: "Send Slack Message", data: { channel: "", message: "" } },
      { value: "action_gmail_read", label: "Read Gmail", data: { query: "is:unread", maxResults: 5 } },
      { value: "action_gmail_send", label: "Send Gmail", data: { to: "", subject: "", body: "" } },
      { value: "action_ai_agent", label: "AI Agent", data: { objective: "", model: "", maxSteps: 6 } },
    ];
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Action type</Label>
          <Select
            onValueChange={(v) => {
              const item = actionTypes.find((a) => a.value === v);
              if (item) onReplaceNode?.(item.value, item.data);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose action type…" />
            </SelectTrigger>
            <SelectContent>
              {actionTypes.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (type === "trigger_event") {
    const event = (data.event as string) || "deal.created";
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Event</Label>
          <Select value={event} onValueChange={(v: string) => onUpdate({ event: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="deal.created">Deal created</SelectItem>
              <SelectItem value="deal.updated">Deal updated</SelectItem>
              <SelectItem value="deal.deleted">Deal deleted</SelectItem>
              <SelectItem value="contact.created">Contact created</SelectItem>
              <SelectItem value="contact.updated">Contact updated</SelectItem>
              <SelectItem value="task.created">Task created</SelectItem>
              <SelectItem value="task.updated">Task updated</SelectItem>
              <SelectItem value="task.deleted">Task deleted</SelectItem>
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
          <Input value={cron} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ cron: e.target.value })} placeholder="0 9 * * 1" />
        </div>
        <div className="space-y-2">
          <Label>Label</Label>
          <Input value={label} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ label: e.target.value })} placeholder="Every Monday at 9am" />
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
          <Input type="email" value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ to: e.target.value })} placeholder="email@example.com" />
        </div>
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input value={subject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ subject: e.target.value })} placeholder="New deal: {{trigger_data.name}}" />
        </div>
        <div className="space-y-2">
          <Label>Body</Label>
          <Textarea value={body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ body: e.target.value })} placeholder="{{ai_result}}" rows={4} />
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
          <Textarea value={prompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ prompt: e.target.value })} placeholder="Summarize {{trigger_data}}" rows={4} />
        </div>
        <div className="space-y-2">
          <Label>Model (optional)</Label>
          <Input value={model} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ model: e.target.value })} placeholder="default" />
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
          <Input value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ query: e.target.value })} placeholder="Use {{variables}}" />
        </div>
        <div className="space-y-2">
          <Label>Num results (1–10)</Label>
          <Input type="number" min={1} max={10} value={numResults} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ numResults: parseInt(e.target.value, 10) || 5 })} />
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
            <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Input value={(params.text as string) ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ params: { ...params, text: e.target.value } })} placeholder="Follow up with {{trigger_data.name}}" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={(params.type as string) ?? "Todo"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ params: { ...params, type: e.target.value } })} placeholder="Todo" />
            </div>
            <div className="space-y-2">
              <Label>Contact ID</Label>
              <Input value={(params.contactId as string) ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ params: { ...params, contactId: e.target.value } })} placeholder="{{trigger_data.contactId}}" />
            </div>
          </>
        )}
        {action === "create_contact" && (
          <>
            <div className="space-y-2">
              <Label>First name</Label>
              <Input value={(params.firstName as string) ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ params: { ...params, firstName: e.target.value } })} placeholder="{{trigger_data.first_name}}" />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input value={(params.lastName as string) ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ params: { ...params, lastName: e.target.value } })} placeholder="{{trigger_data.last_name}}" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={(params.email as string) ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ params: { ...params, email: e.target.value } })} placeholder="{{trigger_data.email}}" />
            </div>
          </>
        )}
        {action === "create_note" && (
          <>
            <div className="space-y-2">
              <Label>Contact ID</Label>
              <Input value={(params.contactId as string) ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ params: { ...params, contactId: e.target.value } })} placeholder="{{trigger_data.contactId}}" />
            </div>
            <div className="space-y-2">
              <Label>Note text</Label>
              <Textarea value={(params.text as string) ?? ""} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ params: { ...params, text: e.target.value } })} placeholder="{{ai_result}}" rows={4} />
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
    const needsConnection = !connectedProviders.includes("slack");
    return (
      <div className="space-y-4">
        {needsConnection && onOpenSettings && <ConnectionRequiredBanner provider="slack" onOpenSettings={onOpenSettings} />}
        <div className="space-y-2">
          <Label>Channel</Label>
          <Input value={channel} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ channel: e.target.value })} placeholder="#general or @username" />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea value={message} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ message: e.target.value })} placeholder="New deal: {{trigger_data.name}}" rows={4} />
        </div>
        <VariableHint />
      </div>
    );
  }

  if (type === "action_gmail_read") {
    const query = (data.query as string) || "is:unread";
    const maxResults = (data.maxResults as number) ?? 5;
    const needsConnection = !connectedProviders.includes("google");
    return (
      <div className="space-y-4">
        {needsConnection && onOpenSettings && <ConnectionRequiredBanner provider="google" onOpenSettings={onOpenSettings} />}
        <div className="space-y-2">
          <Label>Query</Label>
          <Input value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ query: e.target.value })} placeholder="is:unread from:boss@company.com" />
        </div>
        <div className="space-y-2">
          <Label>Max results</Label>
          <Input type="number" min={1} max={20} value={maxResults} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ maxResults: parseInt(e.target.value, 10) || 5 })} />
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
    const needsConnection = !connectedProviders.includes("google");
    return (
      <div className="space-y-4">
        {needsConnection && onOpenSettings && <ConnectionRequiredBanner provider="google" onOpenSettings={onOpenSettings} />}
        <div className="space-y-2">
          <Label>To</Label>
          <Input value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ to: e.target.value })} placeholder="recipient@example.com" />
        </div>
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input value={subject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ subject: e.target.value })} placeholder="Update: {{trigger_data.name}}" />
        </div>
        <div className="space-y-2">
          <Label>Body</Label>
          <Textarea value={body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ body: e.target.value })} placeholder="{{ai_result}}" rows={4} />
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
          <Textarea value={objective} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ objective: e.target.value })} placeholder="Find contacts from {{trigger_data.company}} and create a follow-up task" rows={4} />
        </div>
        <div className="space-y-2">
          <Label>Max steps</Label>
          <Input type="number" min={1} max={10} value={maxSteps} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ maxSteps: parseInt(e.target.value, 10) || 6 })} />
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
