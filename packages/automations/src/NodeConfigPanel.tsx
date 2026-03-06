import { Button } from "basics-os/src/components/ui/button";
import { Label } from "basics-os/src/components/ui/label";
import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "basics-os/src/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "basics-os/src/components/ui/accordion";
import { useAutomationBuilder } from "./AutomationBuilderContext";
import { VariableInput, VariableTextarea } from "./VariablePicker";
import { EntityPickerInput } from "./EntityPicker";
import { useAvailableVariables } from "./useAvailableVariables";
import type { WorkflowNode } from "./builderConstants";

function ConnectionRequiredBanner({
  provider,
  onOpenSettings,
}: {
  provider: string;
  onOpenSettings: () => void;
}) {
  const label =
    provider === "slack" ? "Slack" : provider === "google" ? "Gmail" : provider;
  return (
    <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
      <p className="font-medium text-amber-800 dark:text-amber-200">
        Connect {label} to run this step
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Connect {label} in Settings to use this action.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={onOpenSettings}
      >
        Connect in Settings
      </Button>
    </div>
  );
}

function OutputHint({
  code,
  description,
}: {
  code: string;
  description?: string;
}) {
  return (
    <div className="space-y-1 rounded-md bg-muted p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">
        Outputs: <code className="font-mono">{code}</code>
      </p>
      {description && <p>{description}</p>}
    </div>
  );
}

function ConfigAccordion({
  required,
  mapping,
  advanced,
  output,
}: {
  required: ReactNode;
  mapping?: ReactNode;
  advanced?: ReactNode;
  output?: ReactNode;
}) {
  const defaultValue = ["required", "mapping"];
  if (advanced) defaultValue.push("advanced");
  if (output) defaultValue.push("output");

  return (
    <Accordion
      type="multiple"
      defaultValue={defaultValue}
      className="w-full rounded-md border bg-background/30 px-3"
    >
      <AccordionItem value="required">
        <AccordionTrigger className="py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Required
        </AccordionTrigger>
        <AccordionContent className="pt-0 pb-3">
          <div className="space-y-3">{required}</div>
        </AccordionContent>
      </AccordionItem>
      {mapping && (
        <AccordionItem value="mapping">
          <AccordionTrigger className="py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mapping
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-3">
            <div className="space-y-3">{mapping}</div>
          </AccordionContent>
        </AccordionItem>
      )}
      {advanced && (
        <AccordionItem value="advanced">
          <AccordionTrigger className="py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Advanced
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-3">
            <div className="space-y-3">{advanced}</div>
          </AccordionContent>
        </AccordionItem>
      )}
      {output && (
        <AccordionItem value="output">
          <AccordionTrigger className="py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Output
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-3">{output}</AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
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
  const { connectedProviders, nodes, edges, nodeTypeLabels } =
    useAutomationBuilder();
  const variables = useAvailableVariables(
    node.id,
    nodes,
    edges,
    nodeTypeLabels,
  );

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
                onReplaceNode?.("trigger_schedule", {
                  cron: "0 9 * * 1",
                  label: "Every Monday at 9am",
                });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose event type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trigger_event">
                Event (deal, contact, task)
              </SelectItem>
              <SelectItem value="trigger_schedule">Schedule (cron)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (type === "action") {
    const actionTypes = [
      {
        value: "action_email",
        label: "Send Email",
        data: { to: "", subject: "", body: "" },
      },
      { value: "action_ai", label: "AI Task", data: { prompt: "" } },
      {
        value: "action_web_search",
        label: "Web Search",
        data: { query: "", numResults: 5 },
      },
      {
        value: "action_crm",
        label: "CRM Action",
        data: {
          action: "create_task",
          params: { text: "", type: "task", contactId: undefined },
        },
      },
      {
        value: "action_slack",
        label: "Send Slack Message",
        data: { channel: "", message: "" },
      },
      {
        value: "action_gmail_read",
        label: "Read Gmail",
        data: { query: "is:unread", maxResults: 5 },
      },
      {
        value: "action_gmail_send",
        label: "Send Gmail",
        data: { to: "", subject: "", body: "" },
      },
      {
        value: "action_ai_agent",
        label: "AI Agent",
        data: { objective: "", model: "", maxSteps: 6 },
      },
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
              <SelectValue placeholder="Choose action type..." />
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
          <Select
            value={event}
            onValueChange={(v: string) => onUpdate({ event: v })}
          >
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
      <ConfigAccordion
        required={
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
        }
        mapping={
          <div className="space-y-2">
            <Label>Cron expression</Label>
            <VariableInput
              value={cron}
              onChange={(v) => onUpdate({ cron: v })}
              variables={variables}
              placeholder="0 9 * * 1"
            />
          </div>
        }
        advanced={
          <div className="space-y-2">
            <Label>Label</Label>
            <VariableInput
              value={label}
              onChange={(v) => onUpdate({ label: v })}
              variables={variables}
              placeholder="Every Monday at 9am"
            />
          </div>
        }
      />
    );
  }

  if (type === "action_email") {
    const to = (data.to as string) || "";
    const subject = (data.subject as string) || "";
    const body = (data.body as string) || "";
    return (
      <ConfigAccordion
        required={
          <div className="space-y-2">
            <Label>To</Label>
            <VariableInput
              type="email"
              value={to}
              onChange={(v) => onUpdate({ to: v })}
              variables={variables}
              placeholder="email@example.com"
            />
          </div>
        }
        mapping={
          <>
            <div className="space-y-2">
              <Label>Subject</Label>
              <VariableInput
                value={subject}
                onChange={(v) => onUpdate({ subject: v })}
                variables={variables}
                placeholder="New deal: {{trigger_data.name}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <VariableTextarea
                value={body}
                onChange={(v) => onUpdate({ body: v })}
                variables={variables}
                placeholder="{{ai_result}}"
                rows={4}
              />
            </div>
          </>
        }
      />
    );
  }

  if (type === "action_ai") {
    const prompt = (data.prompt as string) || "";
    const model = (data.model as string) || "";
    return (
      <ConfigAccordion
        required={
          <div className="space-y-2">
            <Label>Prompt</Label>
            <VariableTextarea
              value={prompt}
              onChange={(v) => onUpdate({ prompt: v })}
              variables={variables}
              placeholder="Summarize {{trigger_data}}"
              rows={4}
            />
          </div>
        }
        advanced={
          <div className="space-y-2">
            <Label>Model (optional)</Label>
            <VariableInput
              value={model}
              onChange={(v) => onUpdate({ model: v })}
              variables={variables}
              placeholder="default"
            />
          </div>
        }
        output={
          <OutputHint
            code="{{ai_result}}"
            description="Use this in later steps as the AI output."
          />
        }
      />
    );
  }

  if (type === "action_web_search") {
    const query = (data.query as string) || "";
    const numResults = (data.numResults as number) ?? 5;
    return (
      <ConfigAccordion
        required={
          <div className="space-y-2">
            <Label>Query</Label>
            <VariableInput
              value={query}
              onChange={(v) => onUpdate({ query: v })}
              variables={variables}
              placeholder="Use {{variables}}"
            />
          </div>
        }
        advanced={
          <div className="space-y-2">
            <Label>Num results (1-10)</Label>
            <VariableInput
              type="number"
              min={1}
              max={10}
              value={String(numResults)}
              onChange={(v) => onUpdate({ numResults: parseInt(v, 10) || 5 })}
              variables={variables}
            />
          </div>
        }
        output={
          <OutputHint
            code="{{web_search_results}}"
            description="Search results available to downstream steps."
          />
        }
      />
    );
  }

  if (type === "action_crm") {
    const action = (data.action as string) || "create_task";
    const params = (data.params as Record<string, unknown>) ?? {};
    let mapping: ReactNode = null;

    if (action === "create_task") {
      mapping = (
        <>
          <div className="space-y-2">
            <Label>Task text</Label>
            <VariableInput
              value={(params.text as string) ?? ""}
              onChange={(v) => onUpdate({ params: { ...params, text: v } })}
              variables={variables}
              placeholder="Follow up with {{trigger_data.name}}"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <VariableInput
              value={(params.type as string) ?? "Todo"}
              onChange={(v) => onUpdate({ params: { ...params, type: v } })}
              variables={variables}
              placeholder="Todo"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact</Label>
            <EntityPickerInput
              resource="contacts"
              value={String(params.contactId ?? "")}
              onChange={(v) =>
                onUpdate({ params: { ...params, contactId: v || undefined } })
              }
              variables={variables}
              placeholder="{{trigger_data.contactId}}"
            />
          </div>
        </>
      );
    }

    if (action === "create_contact") {
      mapping = (
        <>
          <div className="space-y-2">
            <Label>First name</Label>
            <VariableInput
              value={(params.firstName as string) ?? ""}
              onChange={(v) =>
                onUpdate({ params: { ...params, firstName: v } })
              }
              variables={variables}
              placeholder="{{trigger_data.first_name}}"
            />
          </div>
          <div className="space-y-2">
            <Label>Last name</Label>
            <VariableInput
              value={(params.lastName as string) ?? ""}
              onChange={(v) => onUpdate({ params: { ...params, lastName: v } })}
              variables={variables}
              placeholder="{{trigger_data.last_name}}"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <VariableInput
              value={(params.email as string) ?? ""}
              onChange={(v) => onUpdate({ params: { ...params, email: v } })}
              variables={variables}
              placeholder="{{trigger_data.email}}"
            />
          </div>
        </>
      );
    }

    if (action === "create_note") {
      mapping = (
        <>
          <div className="space-y-2">
            <Label>Contact</Label>
            <EntityPickerInput
              resource="contacts"
              value={String(params.contactId ?? "")}
              onChange={(v) =>
                onUpdate({ params: { ...params, contactId: v || undefined } })
              }
              variables={variables}
              placeholder="{{trigger_data.contactId}}"
            />
          </div>
          <div className="space-y-2">
            <Label>Note text</Label>
            <VariableTextarea
              value={(params.text as string) ?? ""}
              onChange={(v) => onUpdate({ params: { ...params, text: v } })}
              variables={variables}
              placeholder="{{ai_result}}"
              rows={4}
            />
          </div>
        </>
      );
    }

    if (action === "create_deal_note") {
      mapping = (
        <>
          <div className="space-y-2">
            <Label>Deal</Label>
            <EntityPickerInput
              resource="deals"
              value={String(params.dealId ?? "")}
              onChange={(v) =>
                onUpdate({ params: { ...params, dealId: v || undefined } })
              }
              variables={variables}
              placeholder="{{trigger_data.id}}"
            />
          </div>
          <div className="space-y-2">
            <Label>Note text</Label>
            <VariableTextarea
              value={(params.text as string) ?? ""}
              onChange={(v) => onUpdate({ params: { ...params, text: v } })}
              variables={variables}
              placeholder="{{ai_result}}"
              rows={4}
            />
          </div>
        </>
      );
    }

    if (action === "update_deal") {
      mapping = (
        <>
          <div className="space-y-2">
            <Label>Deal</Label>
            <EntityPickerInput
              resource="deals"
              value={String(params.dealId ?? "")}
              onChange={(v) =>
                onUpdate({ params: { ...params, dealId: v || undefined } })
              }
              variables={variables}
              placeholder="{{trigger_data.id}}"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <VariableInput
              value={(params.status as string) ?? ""}
              onChange={(v) => onUpdate({ params: { ...params, status: v } })}
              variables={variables}
              placeholder="e.g. proposal-made, in-negotiation, won"
            />
          </div>
          <div className="space-y-2">
            <Label>Name (optional)</Label>
            <VariableInput
              value={(params.name as string) ?? ""}
              onChange={(v) => onUpdate({ params: { ...params, name: v } })}
              variables={variables}
              placeholder="{{trigger_data.name}}"
            />
          </div>
          <div className="space-y-2">
            <Label>Amount in cents (optional)</Label>
            <VariableInput
              value={(params.amount as string) ?? ""}
              onChange={(v) => onUpdate({ params: { ...params, amount: v } })}
              variables={variables}
              placeholder="{{trigger_data.amount}}"
            />
          </div>
        </>
      );
    }

    return (
      <ConfigAccordion
        required={
          <div className="space-y-2">
            <Label>Action</Label>
            <Select
              value={action}
              onValueChange={(v: string) => onUpdate({ action: v, params: {} })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create_task">Create task</SelectItem>
                <SelectItem value="create_contact">Create contact</SelectItem>
                <SelectItem value="create_note">
                  Create note (on contact)
                </SelectItem>
                <SelectItem value="create_deal_note">
                  Create deal note
                </SelectItem>
                <SelectItem value="update_deal">Update deal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        mapping={mapping}
        output={
          <OutputHint
            code="{{crm_result}}"
            description="Result payload from this CRM action."
          />
        }
      />
    );
  }

  if (type === "action_slack") {
    const channel = (data.channel as string) || "";
    const message = (data.message as string) || "";
    const needsConnection = !connectedProviders.includes("slack");
    return (
      <ConfigAccordion
        required={
          <>
            {needsConnection && onOpenSettings && (
              <ConnectionRequiredBanner
                provider="slack"
                onOpenSettings={onOpenSettings}
              />
            )}
            <div className="space-y-2">
              <Label>Channel</Label>
              <VariableInput
                value={channel}
                onChange={(v) => onUpdate({ channel: v })}
                variables={variables}
                placeholder="#general or @username"
              />
            </div>
          </>
        }
        mapping={
          <div className="space-y-2">
            <Label>Message</Label>
            <VariableTextarea
              value={message}
              onChange={(v) => onUpdate({ message: v })}
              variables={variables}
              placeholder="New deal: {{trigger_data.name}}"
              rows={4}
            />
          </div>
        }
        output={
          <OutputHint
            code="{{slack_result}}"
            description="Delivery status for the Slack message."
          />
        }
      />
    );
  }

  if (type === "action_gmail_read") {
    const query = (data.query as string) || "is:unread";
    const maxResults = (data.maxResults as number) ?? 5;
    const needsConnection = !connectedProviders.includes("google");
    return (
      <ConfigAccordion
        required={
          <>
            {needsConnection && onOpenSettings && (
              <ConnectionRequiredBanner
                provider="google"
                onOpenSettings={onOpenSettings}
              />
            )}
            <div className="space-y-2">
              <Label>Query</Label>
              <VariableInput
                value={query}
                onChange={(v) => onUpdate({ query: v })}
                variables={variables}
                placeholder="is:unread from:boss@company.com"
              />
            </div>
          </>
        }
        advanced={
          <div className="space-y-2">
            <Label>Max results</Label>
            <VariableInput
              type="number"
              min={1}
              max={20}
              value={String(maxResults)}
              onChange={(v) => onUpdate({ maxResults: parseInt(v, 10) || 5 })}
              variables={variables}
            />
          </div>
        }
        output={
          <OutputHint
            code="{{gmail_messages}}"
            description="Array of messages read from Gmail."
          />
        }
      />
    );
  }

  if (type === "action_gmail_send") {
    const to = (data.to as string) || "";
    const subject = (data.subject as string) || "";
    const body = (data.body as string) || "";
    const needsConnection = !connectedProviders.includes("google");
    return (
      <ConfigAccordion
        required={
          <>
            {needsConnection && onOpenSettings && (
              <ConnectionRequiredBanner
                provider="google"
                onOpenSettings={onOpenSettings}
              />
            )}
            <div className="space-y-2">
              <Label>To</Label>
              <VariableInput
                value={to}
                onChange={(v) => onUpdate({ to: v })}
                variables={variables}
                placeholder="recipient@example.com"
              />
            </div>
          </>
        }
        mapping={
          <>
            <div className="space-y-2">
              <Label>Subject</Label>
              <VariableInput
                value={subject}
                onChange={(v) => onUpdate({ subject: v })}
                variables={variables}
                placeholder="Update: {{trigger_data.name}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <VariableTextarea
                value={body}
                onChange={(v) => onUpdate({ body: v })}
                variables={variables}
                placeholder="{{ai_result}}"
                rows={4}
              />
            </div>
          </>
        }
        output={
          <OutputHint
            code="{{gmail_send_result}}"
            description="Send response metadata from Gmail."
          />
        }
      />
    );
  }

  if (type === "action_ai_agent") {
    const objective = (data.objective as string) || "";
    const maxSteps = (data.maxSteps as number) ?? 6;
    return (
      <ConfigAccordion
        required={
          <div className="space-y-2">
            <Label>Objective</Label>
            <VariableTextarea
              value={objective}
              onChange={(v) => onUpdate({ objective: v })}
              variables={variables}
              placeholder="Find contacts from {{trigger_data.company}} and create a follow-up task"
              rows={4}
            />
          </div>
        }
        advanced={
          <div className="space-y-2">
            <Label>Max steps</Label>
            <VariableInput
              type="number"
              min={1}
              max={10}
              value={String(maxSteps)}
              onChange={(v) => onUpdate({ maxSteps: parseInt(v, 10) || 6 })}
              variables={variables}
            />
          </div>
        }
        output={
          <OutputHint
            code="{{ai_agent_result}}"
            description="The agent can use CRM tools like search contacts/deals, create tasks, and update deals."
          />
        }
      />
    );
  }

  return null;
}
