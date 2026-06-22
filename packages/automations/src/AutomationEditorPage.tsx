import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  GlobeIcon,
  EnvelopeSimpleIcon,
  StackIcon,
  FileTextIcon,
  CodeIcon,
  CalendarIcon,
  SlackLogoIcon,
  PlayIcon,
  ClockCounterClockwiseIcon,
  type Icon,
} from "@phosphor-icons/react";
import { getOne, create, update } from "basics-os/src/lib/api/crm";
import { fetchApi } from "basics-os/src/lib/api";
import { getRuntimeApiUrl } from "basics-os/src/lib/runtime-config";
import { usePageTitle } from "basics-os/src/contexts/page-header";
import { Button } from "basics-os/src/components/ui/button";
import { Input } from "basics-os/src/components/ui/input";
import { Label } from "basics-os/src/components/ui/label";
import { Switch } from "basics-os/src/components/ui/switch";
import { Badge } from "basics-os/src/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "basics-os/src/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "basics-os/src/components/ui/select";
import { AutomationRunsPanel } from "./AutomationRunsPanel";
import type { AutomationRule } from "./AutomationListPage";

// ─── trigger helpers ────────────────────────────────────────────────────────
const EVENTS = [
  { value: "deal.created", label: "When a deal is created" },
  { value: "deal.stage_changed", label: "When a deal's stage changes" },
  { value: "deal.updated", label: "When a deal is updated" },
  { value: "contact.created", label: "When a contact is created" },
  { value: "contact.updated", label: "When a contact is updated" },
  { value: "company.created", label: "When a company is created" },
  { value: "task.created", label: "When a task is created" },
];
const FILTER_OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in"];
const DOW = [
  { value: "1", label: "Monday" }, { value: "2", label: "Tuesday" }, { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" }, { value: "5", label: "Friday" }, { value: "6", label: "Saturday" }, { value: "0", label: "Sunday" },
];
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Freq = "daily" | "weekdays" | "weekly" | "monthly" | "custom";

function buildCron(freq: Freq, time: string, dow: string, dom: string, customCron: string): string {
  if (freq === "custom") return customCron.trim();
  const [h, m] = time.split(":").map(Number);
  const mm = Number.isFinite(m) ? m : 0;
  const hh = Number.isFinite(h) ? h : 9;
  switch (freq) {
    case "daily": return `${mm} ${hh} * * *`;
    case "weekdays": return `${mm} ${hh} * * 1-5`;
    case "weekly": return `${mm} ${hh} * * ${dow}`;
    case "monthly": return `${mm} ${hh} ${dom} * *`;
    default: return `${mm} ${hh} * * *`;
  }
}

function parseCron(cron: string): { freq: Freq; time: string; dow: string; dom: string; customCron: string } {
  const out = { freq: "custom" as Freq, time: "09:00", dow: "1", dom: "1", customCron: cron };
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return out;
  const [min, hr, dom, mon, dow] = parts;
  out.time = `${String(Number(hr) || 0).padStart(2, "0")}:${String(Number(min) || 0).padStart(2, "0")}`;
  if (dom === "*" && mon === "*") {
    if (dow === "*") return { ...out, freq: "daily" };
    if (dow === "1-5") return { ...out, freq: "weekdays" };
    if (/^[0-6]$/.test(dow)) return { ...out, freq: "weekly", dow };
  }
  if (mon === "*" && dow === "*" && /^\d+$/.test(dom)) return { ...out, freq: "monthly", dom };
  return out;
}

function cronToEnglish(cron: string): string {
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) return cron;
  const [min, hr, dom, mon, dow] = p;
  const h = Number(hr), m = Number(min);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return cron;
  const ampm = h < 12 ? "AM" : "PM";
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${ampm}`;
  if (dom === "*" && mon === "*") {
    if (dow === "*") return `Every day at ${time}`;
    if (dow === "1-5") return `Every weekday at ${time}`;
    if (/^[0-6]$/.test(dow)) return `Every ${DOW_NAMES[Number(dow)]} at ${time}`;
  }
  if (mon === "*" && dow === "*" && /^\d+$/.test(dom)) return `Day ${dom} of each month at ${time}`;
  return cron;
}

function tzShort(tz?: string): string | null {
  if (!tz) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

// Heuristic "what this will use" badges from the instruction text.
const TOOL_MATCHERS: Array<{ re: RegExp; icon: Icon; label: string }> = [
  { re: /\bslack\b/i, icon: SlackLogoIcon, label: "Slack" },
  { re: /\b(gmail|e-?mail|email me|digest|notify)\b/i, icon: EnvelopeSimpleIcon, label: "Email" },
  { re: /\b(web|research|news|search the|competitor|online)\b/i, icon: GlobeIcon, label: "Web" },
  { re: /\b(calendar|meeting|kickoff)\b/i, icon: CalendarIcon, label: "Calendar" },
  { re: /\b(deal|contact|compan|task|note|crm|pipeline|lead)\b/i, icon: StackIcon, label: "CRM" },
  { re: /\b(csv|excel|xlsx|pdf|report|document|invoice|file)\b/i, icon: FileTextIcon, label: "Document" },
  { re: /\b(compute|calculate|total|average|analyz)\b/i, icon: CodeIcon, label: "Compute" },
];
function toolHints(text: string): Array<{ icon: Icon; label: string }> {
  const out: Array<{ icon: Icon; label: string }> = [];
  for (const m of TOOL_MATCHERS) if (m.re.test(text) && !out.some((o) => o.label === m.label)) out.push({ icon: m.icon, label: m.label });
  return out;
}

function getAgentPrompt(rule: AutomationRule | undefined): string {
  return (rule?.workflowDefinition?.nodes?.find((n) => n.type === "action_ai_agent")?.data?.prompt as string) ?? "";
}

export function AutomationEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id || id === "create";
  const ruleId = isNew ? undefined : Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: rule } = useQuery({
    enabled: !isNew && Number.isFinite(ruleId),
    queryKey: ["automation_rules", ruleId],
    queryFn: () => getOne<AutomationRule>("automation_rules", ruleId!),
  });
  const { data: tz } = useQuery({
    queryKey: ["me-timezone"],
    queryFn: () =>
      fetch(`${getRuntimeApiUrl()}/api/me/timezone`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d?.effective as string | undefined) ?? undefined),
  });
  const tzLabel = tzShort(tz);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<"schedule" | "event">("schedule");
  const [freq, setFreq] = useState<Freq>("weekdays");
  const [time, setTime] = useState("09:00");
  const [dow, setDow] = useState("1");
  const [dom, setDom] = useState("1");
  const [customCron, setCustomCron] = useState("");
  const [event, setEvent] = useState("deal.stage_changed");
  const [useFilter, setUseFilter] = useState(false);
  const [filterField, setFilterField] = useState("");
  const [filterOp, setFilterOp] = useState("eq");
  const [filterValue, setFilterValue] = useState("");
  const [instruction, setInstruction] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [runsOpen, setRunsOpen] = useState(false);

  usePageTitle(isNew ? "New automation" : "Edit automation");

  // Hydrate the form from an existing rule.
  useEffect(() => {
    if (isNew || !rule || hydrated) return;
    setName(rule.name ?? "");
    setEnabled(rule.enabled ?? true);
    setInstruction(getAgentPrompt(rule));
    const nodes = rule.workflowDefinition?.nodes ?? [];
    const sched = nodes.find((n) => n.type === "trigger_schedule");
    const ev = nodes.find((n) => n.type === "trigger_event");
    if (sched) {
      setTriggerType("schedule");
      const c = parseCron((sched.data?.cron as string) ?? "0 9 * * 1-5");
      setFreq(c.freq); setTime(c.time); setDow(c.dow); setDom(c.dom); setCustomCron(c.customCron);
    } else if (ev) {
      setTriggerType("event");
      setEvent((ev.data?.event as string) ?? "deal.stage_changed");
      const f = ev.data?.filter as { field?: string; op?: string; value?: unknown } | undefined;
      if (f?.field) {
        setUseFilter(true); setFilterField(f.field); setFilterOp(f.op ?? "eq"); setFilterValue(String(f.value ?? ""));
      }
    }
    setHydrated(true);
  }, [rule, isNew, hydrated]);

  const cron = useMemo(() => buildCron(freq, time, dow, dom, customCron), [freq, time, dow, dom, customCron]);
  const hints = useMemo(() => toolHints(instruction), [instruction]);

  function buildWorkflowDefinition() {
    const trigger =
      triggerType === "schedule"
        ? { id: "trigger", type: "trigger_schedule", position: { x: 0, y: 0 }, data: { cron } }
        : {
            id: "trigger",
            type: "trigger_event",
            position: { x: 0, y: 0 },
            data: {
              event,
              ...(useFilter && filterField.trim()
                ? { filter: { field: filterField.trim(), op: filterOp, value: coerce(filterValue) } }
                : {}),
            },
          };
    return {
      nodes: [trigger, { id: "agent", type: "action_ai_agent", position: { x: 0, y: 140 }, data: { prompt: instruction.trim() } }],
      edges: [{ id: "e1", source: "trigger", target: "agent" }],
    };
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim() || "Untitled automation", enabled, workflowDefinition: buildWorkflowDefinition() };
      if (isNew) return create<AutomationRule>("automation_rules", payload);
      return update<AutomationRule>("automation_rules", ruleId!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation_rules"] });
      toast.success(isNew ? "Automation created" : "Automation saved");
      navigate("/automations");
    },
    onError: () => toast.error("Couldn't save the automation"),
  });

  const runNow = useMutation({
    mutationFn: () => fetchApi<{ triggered: boolean }>("/api/automation-runs/run", { method: "POST", body: JSON.stringify({ ruleId }) }),
    onSuccess: () => { toast.success("Run started"); setRunsOpen(true); },
    onError: () => toast.error("Couldn't start the run"),
  });

  const canSave = instruction.trim().length > 0 && (triggerType === "event" ? !!event : !!cron);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto px-1 py-5 pb-12">
      <div className="space-y-1">
        <Label className="text-[12px] text-muted-foreground">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly pipeline digest" autoComplete="off" />
      </div>

      {/* Trigger */}
      <div className="space-y-3">
        <Label className="text-[12px] text-muted-foreground">When should it run?</Label>
        <Tabs value={triggerType} onValueChange={(v) => setTriggerType(v as "schedule" | "event")}>
          <TabsList>
            <TabsTrigger value="schedule">On a schedule</TabsTrigger>
            <TabsTrigger value="event">When something happens</TabsTrigger>
          </TabsList>
        </Tabs>

        {triggerType === "schedule" ? (
          <div className="space-y-3 rounded-[--surface-card-radius] border bg-surface-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={freq} onValueChange={(v) => setFreq(v as Freq)}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekdays">Every weekday</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom (cron)</SelectItem>
                </SelectContent>
              </Select>
              {freq === "weekly" && (
                <Select value={dow} onValueChange={setDow}>
                  <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOW.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {freq === "monthly" && (
                <Input type="number" min={1} max={28} value={dom} onChange={(e) => setDom(e.target.value)} className="h-9 w-[90px]" />
              )}
              {freq !== "custom" && (
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 w-[120px]" />
              )}
              {freq === "custom" && (
                <Input value={customCron} onChange={(e) => setCustomCron(e.target.value)} placeholder="0 9 * * 1-5" className="h-9 w-[180px] font-mono text-[13px]" />
              )}
            </div>
            <p className="text-[12px] text-muted-foreground">
              {cronToEnglish(cron)}{tzLabel ? ` · ${tzLabel}` : ""}
            </p>
          </div>
        ) : (
          <div className="space-y-3 rounded-[--surface-card-radius] border bg-surface-card p-4">
            <Select value={event} onValueChange={setEvent}>
              <SelectTrigger className="h-9 w-full sm:w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>{EVENTS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={useFilter} onCheckedChange={setUseFilter} />
              <span className="text-[13px] text-muted-foreground">Only when a condition matches</span>
            </div>
            {useFilter && (
              <div className="flex flex-wrap items-center gap-2">
                <Input value={filterField} onChange={(e) => setFilterField(e.target.value)} placeholder="field (e.g. newStatus, amount)" className="h-9 w-[200px]" />
                <Select value={filterOp} onValueChange={setFilterOp}>
                  <SelectTrigger className="h-9 w-[90px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{FILTER_OPS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder="value (e.g. won, 50000)" className="h-9 w-[160px]" />
              </div>
            )}
            <p className="text-[12px] text-muted-foreground">
              deal.stage_changed payload: dealId, newStatus, oldStatus, amount, companyId. Other events carry the full record.
            </p>
          </div>
        )}
      </div>

      {/* Instruction */}
      <div className="space-y-2">
        <Label className="text-[12px] text-muted-foreground">What should the agent do?</Label>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={6}
          placeholder="Describe it in plain English — e.g. Summarize my open deals with amounts and next steps, and email me the digest. The agent can use your CRM, connected apps (Gmail, Slack, Calendar…), web research, email, code, and documents."
          className="w-full resize-y rounded-[--surface-card-radius] border bg-surface-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {hints.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Likely uses:</span>
            {hints.map((h) => (
              <Badge key={h.label} variant="secondary" className="gap-1 text-[10px] font-normal">
                <h.icon className="size-3" />{h.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-[13px] text-muted-foreground">{enabled ? "Active" : "Paused"}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <Button variant="ghost" size="sm" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
                <PlayIcon className="mr-1.5 size-3.5" weight="fill" /> Run now
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRunsOpen(true)}>
                <ClockCounterClockwiseIcon className="mr-1.5 size-3.5" /> History
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={() => navigate("/automations")}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {isNew ? "Create automation" : "Save"}
          </Button>
        </div>
      </div>

      {!isNew && (
        <AutomationRunsPanel ruleId={runsOpen ? ruleId! : null} open={runsOpen} onOpenChange={(o) => !o && setRunsOpen(false)} />
      )}
    </div>
  );
}

function coerce(v: string): unknown {
  const t = v.trim();
  if (t === "") return "";
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === "true") return true;
  if (t === "false") return false;
  return t;
}
