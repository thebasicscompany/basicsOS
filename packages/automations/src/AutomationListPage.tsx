import {
  DotsThreeIcon,
  PlusIcon,
  ClockIcon,
  LightningIcon,
  RobotIcon,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getList, update, remove } from "basics-os/src/lib/api/crm";
import {
  usePageTitle,
  usePageHeaderActions,
} from "basics-os/src/contexts/page-header";
import { Button } from "basics-os/src/components/ui/button";
import { Switch } from "basics-os/src/components/ui/switch";
import { Badge } from "basics-os/src/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardAction,
} from "basics-os/src/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "basics-os/src/components/ui/dropdown-menu";
import { AutomationRunsPanel } from "./AutomationRunsPanel";
import { toast } from "sonner";
import { useState } from "react";
export interface AutomationRule {
  id: number;
  crmUserId: number;
  name: string;
  enabled: boolean;
  workflowDefinition: {
    nodes: Array<{ type: string; data: Record<string, unknown> }>;
    edges: unknown[];
  };
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function getTriggerLabel(rule: AutomationRule): string {
  const nodes = rule.workflowDefinition?.nodes ?? [];
  const trigger = nodes.find(
    (n) => n.type === "trigger_event" || n.type === "trigger_schedule",
  );
  if (!trigger) return "—";
  if (trigger.type === "trigger_event") {
    return (trigger.data?.event as string)?.replace(".", " ") ?? "Event";
  }
  if (trigger.type === "trigger_schedule") {
    return (
      (trigger.data?.label as string) ||
      (trigger.data?.cron as string) ||
      "Schedule"
    );
  }
  return "—";
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Best-effort plain-English schedule for the common cron shapes. */
function cronToEnglish(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hr, dom, mon, dow] = parts;
  const time = (() => {
    const h = Number(hr), m = Number(min);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  })();
  if (!time) return cron;
  if (dom === "*" && mon === "*") {
    if (dow === "*") return `Every day at ${time}`;
    if (dow === "1-5") return `Every weekday at ${time}`;
    const days = dow.split(",").map((d) => DOW[Number(d)]).filter(Boolean);
    if (days.length) return `Every ${days.join(", ")} at ${time}`;
  }
  return cron;
}

function getTrigger(rule: AutomationRule): { scheduled: boolean; label: string } {
  const nodes = rule.workflowDefinition?.nodes ?? [];
  const sched = nodes.find((n) => n.type === "trigger_schedule");
  if (sched) {
    const cron = sched.data?.cron as string | undefined;
    return { scheduled: true, label: cron ? cronToEnglish(cron) : (sched.data?.label as string) || "On a schedule" };
  }
  const ev = nodes.find((n) => n.type === "trigger_event");
  if (ev) return { scheduled: false, label: `When ${(ev.data?.event as string)?.replace(/[._]/g, " ") ?? "an event happens"}` };
  return { scheduled: true, label: getTriggerLabel(rule) };
}

/** A one-line "what it does" from the agentic step prompt. */
function getStepSummary(rule: AutomationRule): string {
  const nodes = rule.workflowDefinition?.nodes ?? [];
  const ai = nodes.find((n) => n.type === "action_ai_agent");
  const prompt = (ai?.data?.prompt as string | undefined)?.trim();
  if (prompt) return prompt.length > 160 ? `${prompt.slice(0, 160)}…` : prompt;
  return `${nodes.filter((n) => n.type?.startsWith("action")).length} action(s)`;
}

function useAutomationRules() {
  return useQuery({
    queryKey: ["automation_rules"],
    queryFn: () =>
      getList<AutomationRule>("automation_rules", {
        pagination: { page: 1, perPage: 100 },
      }),
  });
}

export function AutomationListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [runsPanelRuleId, setRunsPanelRuleId] = useState<number | null>(null);

  const { data, isPending, isError } = useAutomationRules();
  const updateRule = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AutomationRule> }) =>
      update<AutomationRule>("automation_rules", id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["automation_rules"] }),
  });
  const deleteRule = useMutation({
    mutationFn: (id: number) => remove<AutomationRule>("automation_rules", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation_rules"] });
      toast.success("Automation deleted");
    },
    onError: () => toast.error("Failed to delete automation"),
  });

  const rules = data?.data ?? [];

  usePageTitle("Automations");

  const headerActionsNode = useMemo(
    () => (
      <Button onClick={() => navigate("/automations/create")}>
        <PlusIcon className="mr-2 size-4" />
        New Automation
      </Button>
    ),
    [navigate],
  );
  const headerActionsPortal = usePageHeaderActions(headerActionsNode);

  return (
    <>
      {headerActionsPortal}
      <div className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
        {/* Error */}
        {isError && (
          <p className="text-sm text-destructive">
            Failed to load automations.
          </p>
        )}

        {/* Empty state */}
        {!isPending && !isError && rules.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[--surface-card-radius] border border-dashed py-16 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LightningIcon className="size-5" weight="fill" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No automations yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Ask the assistant in chat — e.g. “every Monday, email me a summary of my open deals” — or create one here.
              </p>
            </div>
            <Button size="sm" onClick={() => navigate("/automations/create")}>
              <PlusIcon className="mr-2 size-4" />
              New Automation
            </Button>
          </div>
        )}

        {/* Card grid */}
        {(isPending || rules.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isPending
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-[150px] animate-pulse rounded-[--surface-card-radius] bg-surface-card" />
                ))
              : rules.map((rule) => {
                  const trigger = getTrigger(rule);
                  return (
                    <Card
                      key={rule.id}
                      className="cursor-pointer gap-0 transition-colors hover:bg-surface-hover"
                      onClick={() => navigate(`/automations/${rule.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="truncate text-[14px]">{rule.name}</CardTitle>
                        <CardAction className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(checked) =>
                              updateRule.mutate({ id: rule.id, data: { enabled: checked } })
                            }
                            disabled={updateRule.isPending}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <DotsThreeIcon className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/automations/${rule.id}`)}>
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRunsPanelRuleId(rule.id)}>
                                Run history
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  if (confirm("Delete this automation?")) deleteRule.mutate(rule.id);
                                }}
                                disabled={deleteRule.isPending}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardAction>
                      </CardHeader>
                      <CardContent className="flex-1 pb-3">
                        <Badge variant="secondary" className="mb-2 gap-1 text-[10px] font-normal">
                          {trigger.scheduled ? <ClockIcon className="size-3" /> : <LightningIcon className="size-3" />}
                          {trigger.label}
                        </Badge>
                        <p className="flex items-start gap-1.5 text-[12px] leading-snug text-muted-foreground">
                          <RobotIcon className="mt-0.5 size-3.5 shrink-0" />
                          <span className="line-clamp-3">{getStepSummary(rule)}</span>
                        </p>
                      </CardContent>
                      <CardFooter className="justify-between border-t pt-3 text-[11px] text-muted-foreground">
                        <span>
                          {rule.enabled ? "Active" : "Paused"} · Last run{" "}
                          {rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleDateString() : "never"}
                        </span>
                        <button
                          className="font-medium text-foreground hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRunsPanelRuleId(rule.id);
                          }}
                        >
                          Runs
                        </button>
                      </CardFooter>
                    </Card>
                  );
                })}
          </div>
        )}

        <AutomationRunsPanel
          ruleId={runsPanelRuleId}
          open={runsPanelRuleId !== null}
          onOpenChange={(open) => !open && setRunsPanelRuleId(null)}
        />
      </div>
    </>
  );
}
