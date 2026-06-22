import {
  DotsThreeIcon,
  PlusIcon,
  ClockIcon,
  LightningIcon,
  RobotIcon,
  GlobeIcon,
  EnvelopeSimpleIcon,
  StackIcon,
  FileTextIcon,
  CodeIcon,
  CalendarIcon,
  PlayIcon,
  SparkleIcon,
  ArrowRightIcon,
  SlackLogoIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getList, update, remove } from "basics-os/src/lib/api/crm";
import { getRuntimeApiUrl } from "basics-os/src/lib/runtime-config";
import { usePageTitle, usePageHeaderActions } from "basics-os/src/contexts/page-header";
import { Button } from "basics-os/src/components/ui/button";
import { Switch } from "basics-os/src/components/ui/switch";
import { Badge } from "basics-os/src/components/ui/badge";
import { Input } from "basics-os/src/components/ui/input";
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

// ─── Capability-showcase templates (chat-first starters) ────────────────────
interface Template {
  icon: Icon;
  title: string;
  desc: string;
  tag: string;
  prompt: string;
}
const TEMPLATES: Template[] = [
  {
    icon: EnvelopeSimpleIcon,
    title: "Weekly pipeline digest",
    desc: "Every Monday, email yourself a summary of open deals.",
    tag: "Email",
    prompt:
      "Every Monday at 8am, summarize all my open deals — name, amount, stage, and the next step for each — and email me the digest with the total pipeline value at the top.",
  },
  {
    icon: SlackLogoIcon,
    title: "Big win → Slack",
    desc: "Celebrate in #sales when a deal over $50k is won.",
    tag: "Slack",
    prompt:
      "Whenever a deal is won and its amount is over $50,000, post a celebration to the #sales channel in Slack with the deal name, amount, and company.",
  },
  {
    icon: GlobeIcon,
    title: "Daily account news brief",
    desc: "Research your top accounts and email you a brief.",
    tag: "Web research",
    prompt:
      "Every weekday at 8am, take my top accounts by open pipeline, search the web for any news, funding, or leadership changes in the last day, and email me a one-paragraph brief per account with source links.",
  },
  {
    icon: StackIcon,
    title: "Won deal → onboarding",
    desc: "Auto-create a task and kickoff note when a deal is won.",
    tag: "CRM",
    prompt:
      "Whenever a deal is won, create an onboarding task due in 3 days and add a note to the deal summarizing the won amount and the agreed next steps.",
  },
  {
    icon: FileTextIcon,
    title: "Monthly pipeline report",
    desc: "Generate an Excel report on the 1st and email it.",
    tag: "Documents",
    prompt:
      "On the 1st of every month at 7am, pull all my deals, generate an Excel (.xlsx) pipeline report with totals by stage and by owner, and email it to me.",
  },
  {
    icon: CalendarIcon,
    title: "Pre-meeting dossier",
    desc: "Research today's meetings and email a prep sheet.",
    tag: "Cross-app",
    prompt:
      "Every weekday at 7am, check my Google Calendar for today's external meetings, match attendees to CRM contacts and companies, research each company online, and email me a prep dossier with talking points.",
  },
  {
    icon: RobotIcon,
    title: "New lead research",
    desc: "Enrich + research every new contact, saved as a note.",
    tag: "Web + CRM",
    prompt:
      "Whenever a new contact is created, research the person and their company on the web, then save a note on the contact with their role, company size, recent news, and a suggested opening line.",
  },
  {
    icon: LightningIcon,
    title: "Won deal → Slack + Calendar",
    desc: "Announce the win and schedule a kickoff.",
    tag: "Cross-app",
    prompt:
      "Whenever a deal is won, post a win announcement to #sales in Slack and create a 30-minute kickoff event on my Google Calendar for next Tuesday at 10am titled 'Kickoff: <deal name>'.",
  },
];

// ─── Tool / connection badges (heuristic from the agent prompt + node types) ──
const TOOL_MATCHERS: Array<{ re: RegExp; icon: Icon; label: string }> = [
  { re: /\bslack\b/i, icon: SlackLogoIcon, label: "Slack" },
  { re: /\b(gmail|e-?mail|email me|digest|notify me|send.*(mail|note))\b/i, icon: EnvelopeSimpleIcon, label: "Email" },
  { re: /\b(web|research|news|search the (web|internet|online)|competitor|online)\b/i, icon: GlobeIcon, label: "Web" },
  { re: /\b(calendar|meeting|kickoff event|schedule (a|an))\b/i, icon: CalendarIcon, label: "Calendar" },
  { re: /\b(deal|contact|compan(y|ies)|task|note|crm|pipeline|lead)\b/i, icon: StackIcon, label: "CRM" },
  { re: /\b(csv|excel|xlsx|pdf|spreadsheet|report|document|invoice|deck|attach)\b/i, icon: FileTextIcon, label: "Document" },
  { re: /\b(compute|calculate|total|average|win rate|aggregate|analyz)\b/i, icon: CodeIcon, label: "Compute" },
];
function getToolBadges(rule: AutomationRule): Array<{ icon: Icon; label: string }> {
  const nodes = rule.workflowDefinition?.nodes ?? [];
  const prompt = (nodes.find((n) => n.type === "action_ai_agent")?.data?.prompt as string) ?? "";
  const text = `${prompt} ${nodes.map((n) => n.type).join(" ")}`;
  const out: Array<{ icon: Icon; label: string }> = [];
  for (const m of TOOL_MATCHERS) {
    if (m.re.test(text) && !out.some((o) => o.label === m.label)) out.push({ icon: m.icon, label: m.label });
  }
  return out.slice(0, 4);
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function tzShort(tz?: string): string | null {
  if (!tz) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

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
  return { scheduled: true, label: "On a schedule" };
}

function getStepSummary(rule: AutomationRule): string {
  const nodes = rule.workflowDefinition?.nodes ?? [];
  const prompt = (nodes.find((n) => n.type === "action_ai_agent")?.data?.prompt as string | undefined)?.trim();
  if (prompt) return prompt.length > 150 ? `${prompt.slice(0, 150)}…` : prompt;
  return `${nodes.filter((n) => n.type?.startsWith("action")).length} action(s)`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

function useAutomationRules() {
  return useQuery({
    queryKey: ["automation_rules"],
    queryFn: () => getList<AutomationRule>("automation_rules", { pagination: { page: 1, perPage: 100 } }),
  });
}

/** Chat-first authoring: open chat seeded with a prompt. */
function useChatSeed() {
  const navigate = useNavigate();
  return (initialText: string) => navigate("/chat", { state: { initialText } });
}

export function AutomationListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const seedChat = useChatSeed();
  const [runsPanelRuleId, setRunsPanelRuleId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const { data, isPending, isError } = useAutomationRules();
  const { data: tz } = useQuery({
    queryKey: ["me-timezone"],
    queryFn: () =>
      fetch(`${getRuntimeApiUrl()}/api/me/timezone`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d?.effective as string | undefined) ?? undefined),
  });
  const tzLabel = tzShort(tz);

  const updateRule = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AutomationRule> }) =>
      update<AutomationRule>("automation_rules", id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation_rules"] }),
  });
  const deleteRule = useMutation({
    mutationFn: (id: number) => remove<AutomationRule>("automation_rules", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation_rules"] });
      toast.success("Automation deleted");
    },
    onError: () => toast.error("Failed to delete automation"),
  });
  const runNow = useMutation({
    mutationFn: (ruleId: number) =>
      fetch(`${getRuntimeApiUrl()}/api/automation-runs/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId }),
      }),
    onSuccess: (_r, ruleId) => {
      toast.success("Run started");
      setRunsPanelRuleId(ruleId);
    },
    onError: () => toast.error("Couldn't start the run"),
  });

  const rules = data?.data ?? [];
  usePageTitle("Automations");

  const headerActionsNode = useMemo(
    () => (
      <Button onClick={() => seedChat("Help me create a new automation. Here's what I want it to do: ")}>
        <SparkleIcon className="mr-2 size-4" weight="fill" />
        New automation
      </Button>
    ),
    [seedChat],
  );
  const headerActionsPortal = usePageHeaderActions(headerActionsNode);

  const submitDraft = () => {
    const t = draft.trim();
    if (!t) return;
    seedChat(`Create an automation that does this: ${t}`);
  };

  return (
    <>
      {headerActionsPortal}
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 px-1 py-5">
        {/* Hero — chat-first, capability-forward */}
        <section className="rounded-[--surface-card-radius] border bg-surface-card p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LightningIcon className="size-5" weight="fill" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Automate your operating system</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Describe it in plain English — the agent runs it on a schedule or when something happens, using your
                CRM, connected apps (Gmail, Slack, Calendar…), web research, email, and documents.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitDraft()}
              placeholder="e.g. Every Friday, email me the deals closing next week…"
              className="flex-1"
            />
            <Button onClick={submitDraft} disabled={!draft.trim()}>
              Create <ArrowRightIcon className="ml-1.5 size-4" />
            </Button>
          </div>
        </section>

        {/* Template gallery */}
        <section className="space-y-3">
          <h3 className="text-[13px] font-medium text-muted-foreground">Start from a template</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => seedChat(t.prompt)}
                className="group flex flex-col gap-2 rounded-[--surface-card-radius] border bg-surface-card p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <t.icon className="size-4" weight="bold" />
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-normal">{t.tag}</Badge>
                </div>
                <div>
                  <p className="text-[13px] font-medium leading-tight">{t.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Your automations */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-muted-foreground">
              Your automations{tzLabel ? ` · scheduled in ${tzLabel}` : ""}
            </h3>
          </div>

          {isError && <p className="text-sm text-destructive">Failed to load automations.</p>}

          {!isPending && !isError && rules.length === 0 && (
            <div className="rounded-[--surface-card-radius] border border-dashed px-4 py-10 text-center">
              <p className="text-sm font-medium">No automations yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Pick a template above, or describe what you want in the box — they're yours, run on your schedule, and
                only you see them.
              </p>
            </div>
          )}

          {(isPending || rules.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {isPending
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-[160px] animate-pulse rounded-[--surface-card-radius] bg-surface-card" />
                  ))
                : rules.map((rule) => {
                    const trigger = getTrigger(rule);
                    const toolBadges = getToolBadges(rule);
                    return (
                      <Card key={rule.id} className="gap-0">
                        <CardHeader className="gap-0 pb-2">
                          <CardTitle className="truncate text-sm font-semibold">{rule.name}</CardTitle>
                          <CardAction className="flex items-center gap-1">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(checked) => updateRule.mutate({ id: rule.id, data: { enabled: checked } })}
                              disabled={updateRule.isPending}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8">
                                  <DotsThreeIcon className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => runNow.mutate(rule.id)} disabled={runNow.isPending}>
                                  Run now
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    seedChat(`Help me edit my automation "${rule.name}" (automation id ${rule.id}).`)
                                  }
                                >
                                  Edit with chat
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/automations/${rule.id}`)}>
                                  Open builder
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setRunsPanelRuleId(rule.id)}>Run history</DropdownMenuItem>
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

                          <CardContent className="flex-1 space-y-2.5 pb-3">
                            <div className="flex items-center gap-1.5 text-[12px] text-foreground/80">
                              {trigger.scheduled ? <ClockIcon className="size-3.5" /> : <LightningIcon className="size-3.5" />}
                              <span>
                                {trigger.label}
                                {trigger.scheduled && tzLabel ? ` · ${tzLabel}` : ""}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                              {getStepSummary(rule)}
                            </p>
                            {toolBadges.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {toolBadges.map((b) => (
                                  <Badge key={b.label} variant="secondary" className="gap-1 text-[10px] font-normal">
                                    <b.icon className="size-3" />
                                    {b.label}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>

                          <CardFooter className="justify-between border-t pt-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <span className={rule.enabled ? "text-green-500" : ""}>{rule.enabled ? "Active" : "Paused"}</span>
                              · last run {relativeTime(rule.lastRunAt)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                                onClick={() => runNow.mutate(rule.id)}
                                disabled={runNow.isPending}
                              >
                                <PlayIcon className="size-3" weight="fill" /> Run
                              </button>
                              <button className="font-medium text-foreground hover:underline" onClick={() => setRunsPanelRuleId(rule.id)}>
                                Runs
                              </button>
                            </div>
                          </CardFooter>
                        </Card>
                      );
                    })}
            </div>
          )}
        </section>

        <AutomationRunsPanel
          ruleId={runsPanelRuleId}
          open={runsPanelRuleId !== null}
          onOpenChange={(open) => !open && setRunsPanelRuleId(null)}
        />
      </div>
    </>
  );
}
