import { useNavigate } from "react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getList, update, remove } from "basics-os/src/lib/api/crm";
import { usePageTitle, usePageHeaderActions } from "basics-os/src/contexts/page-header";
import { Button } from "basics-os/src/components/ui/button";
import { Switch } from "basics-os/src/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "basics-os/src/components/ui/table";
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
import { MoreHorizontal, Plus, Workflow } from "lucide-react";

export interface AutomationRule {
  id: number;
  salesId: number;
  name: string;
  enabled: boolean;
  workflowDefinition: { nodes: Array<{ type: string; data: Record<string, unknown> }>; edges: unknown[] };
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function getTriggerLabel(rule: AutomationRule): string {
  const nodes = rule.workflowDefinition?.nodes ?? [];
  const trigger = nodes.find((n) => n.type === "trigger_event" || n.type === "trigger_schedule");
  if (!trigger) return "—";
  if (trigger.type === "trigger_event") {
    return (trigger.data?.event as string)?.replace(".", " ") ?? "Event";
  }
  if (trigger.type === "trigger_schedule") {
    return (trigger.data?.label as string) || (trigger.data?.cron as string) || "Schedule";
  }
  return "—";
}

function useAutomationRules() {
  return useQuery({
    queryKey: ["automation_rules"],
    queryFn: () => getList<AutomationRule>("automation_rules", { pagination: { page: 1, perPage: 100 } }),
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

  const rules = data?.data ?? [];

  usePageTitle("Automations");

  const headerActionsNode = useMemo(
    () => (
      <Button onClick={() => navigate("/automations/create")}>
        <Plus className="mr-2 size-4" />
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
        <p className="text-sm text-destructive">Failed to load automations.</p>
      )}

      {/* Empty state */}
      {!isPending && !isError && rules.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <Workflow className="size-7 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold">No automations yet</p>
          <p className="mt-1 mb-6 max-w-xs text-sm text-muted-foreground">
            Build workflows that run automatically when deals, contacts, or tasks change.
          </p>
          <Button onClick={() => navigate("/automations/create")}>
            <Plus className="mr-2 size-4" />
            Create your first automation
          </Button>
        </div>
      )}

      {/* Table */}
      {(isPending || rules.length > 0) && (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending
                ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rules.map((rule) => (
                    <TableRow
                      key={rule.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/automations/${rule.id}`)}
                    >
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize">
                        {getTriggerLabel(rule)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rule.workflowDefinition?.nodes?.length ?? 0} nodes
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rule.lastRunAt
                          ? new Date(rule.lastRunAt).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) =>
                            updateRule.mutate({ id: rule.id, data: { enabled: checked } })
                          }
                          disabled={updateRule.isPending}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
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
                                if (confirm("Delete this automation?")) {
                                  deleteRule.mutate(rule.id);
                                }
                              }}
                              disabled={deleteRule.isPending}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
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
