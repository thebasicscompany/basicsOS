"use client";

import React, { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
  IconBadge,
  SectionLabel,
  addToast,
  Zap,
  CheckSquare,
  Globe,
  Sparkles,
  Mail,
  Users,
  MessageSquare,
} from "@basicsos/ui";
import { ActionBuilder } from "../ActionBuilder";
import type { ActionConfig } from "../action-primitives/index";
import { getTriggerLabel } from "../trigger-meta";

// Derive icon type from an actual import so it stays structurally compatible with Lucide exports.
type LucideIconType = typeof CheckSquare;

const ACTION_META: Record<string, { label: string; Icon: LucideIconType; color: string }> = {
  create_task:   { label: "Create Task",    Icon: CheckSquare, color: "bg-emerald-50 text-emerald-600" },
  call_webhook:  { label: "Call Webhook",   Icon: Globe,       color: "bg-blue-50 text-blue-600" },
  run_ai_prompt: { label: "Run AI Prompt",  Icon: Sparkles,    color: "bg-violet-50 text-violet-600" },
  update_crm:    { label: "Update CRM",     Icon: Users,       color: "bg-sky-50 text-sky-600" },
  send_email:    { label: "Send Email",     Icon: Mail,        color: "bg-amber-50 text-amber-600" },
  post_slack:    { label: "Post to Slack",  Icon: MessageSquare, color: "bg-rose-50 text-rose-600" },
};

const formatDate = (date: Date | string | null): string => {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const formatDuration = (startedAt: Date | string, completedAt: Date | string | null): string => {
  if (!completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const statusVariant = (status: string): "success" | "destructive" | "secondary" | "outline" => {
  if (status === "completed") return "success";
  if (status === "failed") return "destructive";
  if (status === "running") return "secondary";
  return "outline";
};

type RunResult = {
  actionsExecuted?: number;
  executionTimeMs?: number;
  actionResults?: Array<{ type: string; status: string; output: unknown; error?: string }>;
};

// Next.js App Router requires default export — framework exception.
const AutomationDetailPage = ({ params }: { params: Promise<{ id: string }> }): JSX.Element => {
  const { id } = use(params);

  const utils = trpc.useUtils();
  const { data: automation, isLoading: loadingAutomation } = trpc.automations.get.useQuery({ id });
  const { data: runs, isLoading: loadingRuns } = trpc.automations.listRuns.useQuery({ automationId: id });

  const [editingActions, setEditingActions] = useState(false);
  const [draftActions, setDraftActions] = useState<Array<{ type: string; config: ActionConfig }>>([]);

  const updateAutomation = trpc.automations.update.useMutation({
    onSuccess: () => {
      addToast({ title: "Actions saved", variant: "success" });
      void utils.automations.get.invalidate({ id });
      setEditingActions(false);
    },
    onError: (err) => {
      addToast({ title: "Failed to save actions", description: err.message, variant: "destructive" });
    },
  });

  if (loadingAutomation) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-stone-200 dark:bg-stone-700" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-32 rounded-lg bg-stone-200 dark:bg-stone-700" />
          <div className="h-32 rounded-lg bg-stone-200 dark:bg-stone-700" />
        </div>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="text-stone-500 dark:text-stone-400 text-sm">Automation not found.</div>
    );
  }

  const triggerConfig = automation.triggerConfig as { eventType?: string; conditions?: unknown[] } | null;
  const actionChain = Array.isArray(automation.actionChain)
    ? (automation.actionChain as Array<{ type: string; config: unknown }>)
    : [];

  const runList = runs ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={automation.name}
        backHref="/automations"
        backLabel="Automations"
        action={
          <Badge variant={automation.enabled ? "success" : "outline"}>
            {automation.enabled ? "Enabled" : "Disabled"}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Trigger */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-foreground">Trigger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <IconBadge Icon={Zap} size="sm" color="bg-orange-50 text-orange-600" />
              <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                {triggerConfig?.eventType ? getTriggerLabel(triggerConfig.eventType) : "No trigger set"}
              </span>
            </div>
            {Array.isArray(triggerConfig?.conditions) && triggerConfig.conditions.length > 0 && (
              <div className="space-y-1">
                <SectionLabel>Conditions</SectionLabel>
                {(triggerConfig.conditions as Array<{ field: string; operator: string; value: unknown }>).map(
                  (c, i) => (
                    <div key={i} className="text-sm text-stone-600 dark:text-stone-400">
                      <span className="font-mono text-xs bg-stone-100 dark:bg-stone-800 px-1 rounded">{c.field}</span>
                      {" "}{c.operator}{" "}
                      <span className="font-mono text-xs bg-stone-100 dark:bg-stone-800 px-1 rounded">{String(c.value)}</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Chain */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground">
              Actions ({actionChain.length})
            </CardTitle>
            {!editingActions && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraftActions(actionChain.map((a) => ({ type: a.type, config: a.config as ActionConfig })));
                  setEditingActions(true);
                }}
              >
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editingActions ? (
              <div className="space-y-3">
                <ActionBuilder actions={draftActions} onChange={setDraftActions} />
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={updateAutomation.isPending}
                    onClick={() => updateAutomation.mutate({ id, actionChain: draftActions as Array<{ type: "create_task" | "call_webhook" | "run_ai_prompt" | "send_email" | "update_crm" | "post_slack"; config: Record<string, unknown> }> })}
                  >
                    {updateAutomation.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingActions(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : actionChain.length === 0 ? (
              <p className="text-sm text-stone-400 dark:text-stone-500 italic">No actions configured.</p>
            ) : (
              <div className="space-y-2">
                {actionChain.map((action, i) => {
                  const meta = ACTION_META[action.type];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-stone-400 dark:text-stone-500 w-4 text-right">{i + 1}</span>
                      {meta ? (
                        <IconBadge Icon={meta.Icon} size="sm" color={meta.color} />
                      ) : (
                        <div className="h-6 w-6 rounded bg-stone-100 dark:bg-stone-800" />
                      )}
                      <span className="text-sm text-stone-700 dark:text-stone-300">{meta?.label ?? action.type}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">
            Run History ({runList.length})
          </CardTitle>
        </CardHeader>
        {loadingRuns ? (
          <CardContent>
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded bg-stone-100 dark:bg-stone-800" />
              ))}
            </div>
          </CardContent>
        ) : runList.length === 0 ? (
          <CardContent>
            <p className="text-sm text-stone-400 dark:text-stone-500 italic">No runs yet — this automation has not triggered.</p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions Run</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runList.map((run) => {
                const result = run.result as RunResult | null;
                return (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm text-stone-600 dark:text-stone-400">{formatDate(run.startedAt)}</TableCell>
                    <TableCell className="text-sm text-stone-500 dark:text-stone-400">
                      {result?.executionTimeMs != null
                        ? `${result.executionTimeMs}ms`
                        : formatDuration(run.startedAt, run.completedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-stone-500 dark:text-stone-400">
                      {result?.actionsExecuted ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-destructive max-w-xs truncate">
                      {run.error ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default AutomationDetailPage;
