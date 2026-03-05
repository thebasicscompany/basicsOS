"use client";

import { useState, useMemo, Fragment } from "react";
import { Navigate } from "react-router";
import { useMe } from "@/hooks/use-me";
import {
  useAdminUsageSummary,
  useAdminUsageLogs,
  type UsageLog,
  type UsageSummaryByUser,
} from "@/hooks/use-admin";
import { usePageTitle } from "@/contexts/page-header";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CaretRightIcon } from "@phosphor-icons/react";

const FEATURE_LABELS: Record<string, string> = {
  chat: "AI Chat",
  assistant: "Voice Assistant",
  voice_transcription: "Transcription",
  voice_speech: "Text-to-Speech",
  embeddings: "Embeddings",
};

function featureLabel(feature: string) {
  return FEATURE_LABELS[feature] ?? feature;
}

function formatNumber(n: number) {
  return n.toLocaleString();
}

/** Format duration for billing (transcription charges by time). Shows minutes or hours. */
function formatDurationMinHrs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms >= 3600000) return `${(ms / 3600000).toFixed(1)} hrs`;
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)} min`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

const TRANSCRIPTION_FEATURE = "voice_transcription";

function LogRow({ log }: { log: UsageLog }) {
  const date = new Date(log.createdAt);
  const isTranscription = log.feature === TRANSCRIPTION_FEATURE;
  return (
    <tr className="border-b text-[12px] hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </td>
      <td className="px-3 py-2">{log.userName}</td>
      <td className="px-3 py-2">{featureLabel(log.feature)}</td>
      <td className="px-3 py-2">{log.model ?? "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {isTranscription ? "—" : formatNumber(log.inputTokens)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {isTranscription ? "—" : formatNumber(log.outputTokens)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        {isTranscription ? formatDurationMinHrs(log.durationMs) : (log.durationMs != null ? `${(log.durationMs / 1000).toFixed(1)}s` : "—")}
      </td>
    </tr>
  );
}

export function UsagePage() {
  usePageTitle("AI Usage");
  const { data: me } = useMe();
  const [days, setDays] = useState(30);
  const [recentRequestsOpen, setRecentRequestsOpen] = useState(false);
  const [recentRequestsPage, setRecentRequestsPage] = useState(1);
  const isAdmin = Boolean(me?.administrator);

  const { data: summary, isLoading: summaryLoading } = useAdminUsageSummary(
    isAdmin,
    days,
  );
  const { data: logsData, isLoading: logsLoading } = useAdminUsageLogs(
    isAdmin,
    days,
  );

  const LOGS_PAGE_SIZE = 25;
  const logs = logsData?.logs ?? [];
  const totalLogsPages = Math.max(1, Math.ceil(logs.length / LOGS_PAGE_SIZE));
  const paginatedLogs = useMemo(() => {
    const start = (recentRequestsPage - 1) * LOGS_PAGE_SIZE;
    return logs.slice(start, start + LOGS_PAGE_SIZE);
  }, [logs, recentRequestsPage, LOGS_PAGE_SIZE]);

  const userSummary = useMemo(() => {
    if (!summary?.byUser) return [];
    const map = new Map<
      number,
      {
        crmUserId: number;
        userName: string;
        totalRequests: number;
        totalInput: number;
        totalOutput: number;
      }
    >();
    for (const row of summary.byUser) {
      const existing = map.get(row.crmUserId);
      if (existing) {
        existing.totalRequests += row.requestCount;
        existing.totalInput += row.totalInputTokens;
        existing.totalOutput += row.totalOutputTokens;
      } else {
        map.set(row.crmUserId, {
          crmUserId: row.crmUserId,
          userName: row.userName,
          totalRequests: row.requestCount,
          totalInput: row.totalInputTokens,
          totalOutput: row.totalOutputTokens,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalRequests - a.totalRequests,
    );
  }, [summary]);

  /** Group byUser by user for expandable "Usage by User + Feature" (one row per user, expand for features). */
  const byUserGrouped = useMemo(() => {
    if (!summary?.byUser?.length) return [];
    const map = new Map<
      number,
      {
        crmUserId: number;
        userName: string;
        totalRequests: number;
        totalInput: number;
        totalOutput: number;
        totalDurationMs: number;
        rows: UsageSummaryByUser[];
      }
    >();
    for (const row of summary.byUser) {
      const existing = map.get(row.crmUserId);
      if (existing) {
        existing.totalRequests += row.requestCount;
        existing.totalInput += row.totalInputTokens;
        existing.totalOutput += row.totalOutputTokens;
        existing.totalDurationMs += row.totalDurationMs ?? 0;
        existing.rows.push(row);
      } else {
        map.set(row.crmUserId, {
          crmUserId: row.crmUserId,
          userName: row.userName,
          totalRequests: row.requestCount,
          totalInput: row.totalInputTokens,
          totalOutput: row.totalOutputTokens,
          totalDurationMs: row.totalDurationMs ?? 0,
          rows: [row],
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalRequests - a.totalRequests,
    );
  }, [summary]);

  const [expandedUserIds, setExpandedUserIds] = useState<Set<number>>(new Set());
  const toggleUserExpanded = (crmUserId: number) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(crmUserId)) next.delete(crmUserId);
      else next.add(crmUserId);
      return next;
    });
  };

  if (me && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const loading = summaryLoading || logsLoading;

  return (
    <div className="flex h-full flex-col overflow-auto py-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Monitor AI usage across your team — requests, tokens, and cost by
            user and feature.
          </p>
        </div>
        <Select
          value={String(days)}
          onValueChange={(v) => setDays(Number(v))}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-[13px] text-muted-foreground">
            Loading usage data...
          </p>
        </div>
      ) : (
        <div className="max-w-6xl space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Total Requests"
              value={summary?.totals.requestCount ?? 0}
              sub={`Last ${days} days`}
            />
            <StatCard
              label="Input Tokens"
              value={summary?.totals.totalInputTokens ?? 0}
            />
            <StatCard
              label="Output Tokens"
              value={summary?.totals.totalOutputTokens ?? 0}
            />
            <StatCard
              label="Total Tokens"
              value={
                (summary?.totals.totalInputTokens ?? 0) +
                (summary?.totals.totalOutputTokens ?? 0)
              }
            />
          </div>

          {/* Per-user summary */}
          <div className="rounded-xl border bg-background shadow-sm">
            <div className="px-5 py-4">
              <h2 className="text-[15px] font-semibold">Usage by User</h2>
              <p className="text-[12px] text-muted-foreground">
                Aggregated totals per team member
              </p>
            </div>
            <Separator />
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2 text-right">Requests</th>
                    <th className="px-3 py-2 text-right">Input Tokens</th>
                    <th className="px-3 py-2 text-right">Output Tokens</th>
                    <th className="px-3 py-2 text-right">Total Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {userSummary.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-[12px] text-muted-foreground"
                      >
                        No usage recorded yet
                      </td>
                    </tr>
                  ) : (
                    userSummary.map((u) => (
                      <tr
                        key={u.crmUserId}
                        className="border-b text-[12px] hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-3 py-2 font-medium">
                          {u.userName}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(u.totalRequests)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(u.totalInput)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(u.totalOutput)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatNumber(u.totalInput + u.totalOutput)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-user by feature — one row per user, expand to see features */}
          {summary && byUserGrouped.length > 0 && (
            <div className="rounded-xl border bg-background shadow-sm">
              <div className="px-5 py-4">
                <h2 className="text-[15px] font-semibold">
                  Usage by User + Feature
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  One row per user; expand to see breakdown by feature
                </p>
              </div>
              <Separator />
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="w-8 px-1 py-2" aria-label="Expand" />
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Feature</th>
                      <th className="px-3 py-2 text-right">Requests</th>
                      <th className="px-3 py-2 text-right">Input</th>
                      <th className="px-3 py-2 text-right">Output</th>
                      <th className="px-3 py-2 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byUserGrouped.map((userGroup) => {
                      const isExpanded = expandedUserIds.has(userGroup.crmUserId);
                      const hasMultipleFeatures = userGroup.rows.length > 1;
                      return (
                        <Fragment key={userGroup.crmUserId}>
                          <tr
                            className="border-b text-[12px] hover:bg-muted/30 transition-colors"
                          >
                            <td className="w-8 px-1 py-2 align-middle">
                              {hasMultipleFeatures ? (
                                <button
                                  type="button"
                                  onClick={() => toggleUserExpanded(userGroup.crmUserId)}
                                  className="rounded p-0.5 hover:bg-muted"
                                  aria-expanded={isExpanded}
                                >
                                  <CaretRightIcon
                                    className={`size-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                                  />
                                </button>
                              ) : (
                                <span className="inline-block w-4" />
                              )}
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {userGroup.userName}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {hasMultipleFeatures
                                ? `${userGroup.rows.length} features`
                                : featureLabel(userGroup.rows[0].feature)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatNumber(userGroup.totalRequests)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatNumber(userGroup.totalInput)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatNumber(userGroup.totalOutput)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {userGroup.totalDurationMs > 0
                                ? formatDurationMinHrs(userGroup.totalDurationMs)
                                : "—"}
                            </td>
                          </tr>
                          {isExpanded &&
                            userGroup.rows.map((row, i) => {
                              const isTranscription = row.feature === TRANSCRIPTION_FEATURE;
                              return (
                                <tr
                                  key={`${userGroup.crmUserId}-${row.feature}-${i}`}
                                  className="border-b text-[12px] bg-muted/20 hover:bg-muted/30 transition-colors"
                                >
                                  <td className="w-8 px-1 py-2" />
                                  <td className="px-3 py-2 pl-6 text-muted-foreground">
                                    {userGroup.userName}
                                  </td>
                                  <td className="px-3 py-2">
                                    {featureLabel(row.feature)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {formatNumber(row.requestCount)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {isTranscription ? "—" : formatNumber(row.totalInputTokens)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {isTranscription ? "—" : formatNumber(row.totalOutputTokens)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {isTranscription
                                      ? formatDurationMinHrs(row.totalDurationMs ?? null)
                                      : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daily trend */}
          {summary && summary.byDay.length > 0 && (
            <div className="rounded-xl border bg-background shadow-sm">
              <div className="px-5 py-4">
                <h2 className="text-[15px] font-semibold">Daily Trend</h2>
                <p className="text-[12px] text-muted-foreground">
                  Requests and tokens by day
                </p>
              </div>
              <Separator />
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Feature</th>
                      <th className="px-3 py-2 text-right">Requests</th>
                      <th className="px-3 py-2 text-right">Input</th>
                      <th className="px-3 py-2 text-right">Output</th>
                      <th className="px-3 py-2 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byDay.map((row, i) => {
                      const isTranscription = row.feature === TRANSCRIPTION_FEATURE;
                      return (
                        <tr
                          key={`${row.date}-${row.feature}-${i}`}
                          className="border-b text-[12px] hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="px-3 py-2">
                            {featureLabel(row.feature)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatNumber(row.requestCount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {isTranscription ? "—" : formatNumber(row.totalInputTokens)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {isTranscription ? "—" : formatNumber(row.totalOutputTokens)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {isTranscription ? formatDurationMinHrs(row.totalDurationMs ?? null) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request log — collapsed by default, expand to view with pagination */}
          <div className="rounded-xl border bg-background shadow-sm">
            <Collapsible
              open={recentRequestsOpen}
              onOpenChange={setRecentRequestsOpen}
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <h2 className="text-[15px] font-semibold">Recent Requests</h2>
                  <p className="text-[12px] text-muted-foreground">
                    {logs.length === 0
                      ? "No requests recorded yet"
                      : `${formatNumber(logs.length)} requests — expand to view`}
                  </p>
                </div>
                {logs.length > 0 && (
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1">
                      {recentRequestsOpen ? "Collapse" : "Expand"}
                      <CaretRightIcon
                        className={`size-4 transition-transform duration-200 ${recentRequestsOpen ? "rotate-90" : ""}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                )}
              </div>
              <CollapsibleContent>
                <Separator />
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Feature</th>
                        <th className="px-3 py-2">Model</th>
                        <th className="px-3 py-2 text-right">Input</th>
                        <th className="px-3 py-2 text-right">Output</th>
                        <th className="px-3 py-2 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-3 py-6 text-center text-[12px] text-muted-foreground"
                          >
                            No requests in this page
                          </td>
                        </tr>
                      ) : (
                        paginatedLogs.map((log) => (
                          <LogRow key={log.id} log={log} />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {totalLogsPages > 1 && (
                  <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
                    <p className="text-[12px] text-muted-foreground">
                      Page {recentRequestsPage} of {totalLogsPages}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setRecentRequestsPage((p) => Math.max(1, p - 1))
                        }
                        disabled={recentRequestsPage <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setRecentRequestsPage((p) =>
                            Math.min(totalLogsPages, p + 1)
                          )
                        }
                        disabled={recentRequestsPage >= totalLogsPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      )}
    </div>
  );
}

UsagePage.path = "/admin/usage";
