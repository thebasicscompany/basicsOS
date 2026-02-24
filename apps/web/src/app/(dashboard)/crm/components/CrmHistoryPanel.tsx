"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent, EmptyState, Clock } from "@basicsos/ui";

interface CrmHistoryPanelProps {
  entity: "contact" | "company" | "deal";
  recordId: string;
}

function formatTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export const CrmHistoryPanel = ({ entity, recordId }: CrmHistoryPanelProps): JSX.Element => {
  const { data: entries, isLoading } = trpc.crm.auditLog.list.useQuery(
    { entity, recordId },
    { enabled: !!recordId },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-stone-500">Loading history…</p>
        )}

        {!isLoading && (entries == null || entries.length === 0) && (
          <EmptyState
            Icon={Clock}
            heading="No changes recorded"
            description="Field changes will appear here after the first edit."
          />
        )}

        {!isLoading && entries != null && entries.length > 0 && (
          <ul className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-3">
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-stone-100 dark:bg-stone-800">
                  <Clock className="size-3.5 text-stone-500 dark:text-stone-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-stone-900 dark:text-stone-100">
                    <span className="font-semibold">{formatFieldName(entry.field)}</span>
                    {" changed from "}
                    <span className="font-mono text-xs text-stone-600 dark:text-stone-400">
                      {entry.oldValue ?? "—"}
                    </span>
                    {" to "}
                    <span className="font-mono text-xs text-stone-800 dark:text-stone-200">
                      {entry.newValue ?? "—"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                    {formatTimestamp(entry.changedAt)}
                    {" · "}
                    <span className="font-mono">{entry.userId}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
