import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "basics-os/src/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "basics-os/src/components/ui/sheet";
import { Button } from "basics-os/src/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "basics-os/src/components/ui/tabs";
import { CheckCircle2, XCircle, Loader2, Copy } from "lucide-react";

export interface AutomationRun {
  id: number;
  ruleId: number;
  salesId: number;
  status: "running" | "success" | "error";
  result: unknown;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface AutomationRunsPanelProps {
  ruleId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second");
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  return rtf.format(diffDay, "day");
}

export function AutomationRunsPanel({ ruleId, open, onOpenChange }: AutomationRunsPanelProps) {
  const [limit, setLimit] = useState(20);
  const { data: runs = [], isPending } = useQuery({
    queryKey: ["automation-runs", ruleId, limit],
    queryFn: () =>
      fetchApi<AutomationRun[]>(
        `/api/automation-runs?ruleId=${ruleId}&limit=${limit}`
      ),
    enabled: !!ruleId && open,
  });

  const [filter, setFilter] = useState<"all" | "success" | "error">("all");
  const filteredRuns = runs.filter((r) => {
    if (filter === "success") return r.status === "success";
    if (filter === "error") return r.status === "error";
    return true;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Run History</SheetTitle>
        </SheetHeader>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mt-4">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="success">Success</TabsTrigger>
            <TabsTrigger value="error">Error</TabsTrigger>
          </TabsList>
          <TabsContent value={filter} className="mt-0">
            {isPending ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : filteredRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {runs.length === 0 ? "No runs yet." : `No ${filter} runs.`}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredRuns.map((run) => (
                  <RunRow key={run.id} run={run} />
                ))}
                {runs.length >= limit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setLimit((l) => l + 20)}
                  >
                    Load more
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function RunRow({ run }: { run: AutomationRun }) {
  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "—";
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    const ms = b - a;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const date = new Date(run.startedAt);
  const relative = formatRelative(date);
  const fullDatetime = date.toLocaleString();

  const StatusIcon = () => {
    if (run.status === "success")
      return <CheckCircle2 className="size-4 text-green-600 dark:text-green-500 shrink-0" />;
    if (run.status === "error")
      return <XCircle className="size-4 text-destructive shrink-0" />;
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusIcon />
          <span className="text-sm font-medium capitalize">{run.status}</span>
        </div>
        <span
          className="text-xs text-muted-foreground"
          title={fullDatetime}
        >
          {relative}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        Duration: {formatDuration(run.startedAt, run.finishedAt)}
      </div>
      <JsonBlock run={run} />
    </div>
  );
}

function JsonBlock({ run }: { run: AutomationRun }) {
  const text = run.error
    ? JSON.stringify({ error: run.error }, null, 2)
    : JSON.stringify(run.result ?? {}, null, 2);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text);
  }, [text]);

  return (
    <details className="group">
      <summary className="text-xs text-primary hover:underline cursor-pointer select-none">
        Show details
      </summary>
      <div className="mt-2 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 size-7"
          onClick={copy}
          title="Copy to clipboard"
        >
          <Copy className="size-3.5" />
        </Button>
        <pre className="text-xs bg-muted p-3 pr-10 rounded overflow-auto max-h-40 border">
          {text}
        </pre>
      </div>
    </details>
  );
}
