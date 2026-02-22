"use client";

import { Card, CardHeader, CardTitle, CardContent, EmptyState, Sparkles } from "@basicsos/ui";

interface SummaryJson {
  decisions?: string[];
  actionItems?: string[];
  followUps?: string[];
  note?: string;
}

interface SummaryCardProps {
  summaryJson: SummaryJson | null;
  isPending?: boolean;
}

export const SummaryCard = ({ summaryJson, isPending }: SummaryCardProps): JSX.Element => {
  if (isPending === true) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <p className="text-sm text-stone-500">Processing meeting summary…</p>
        </div>
      </Card>
    );
  }

  if (!summaryJson) {
    return (
      <EmptyState
        Icon={Sparkles}
        heading="No summary available"
        description="No summary available yet."
      />
    );
  }

  const { decisions = [], actionItems = [], followUps = [], note } = summaryJson;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {note !== undefined && note.length > 0 && (
          <div className="rounded-sm bg-yellow-50 dark:bg-amber-950/40 border border-yellow-200 dark:border-amber-800 px-3 py-2">
            <p className="text-xs text-yellow-700 dark:text-amber-200">{note}</p>
          </div>
        )}

        {actionItems.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-stone-500">Action Items</h4>
            <ul className="space-y-1">
              {actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                  <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-stone-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {decisions.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-stone-500">Decisions</h4>
            <ul className="space-y-1">
              {decisions.map((item, i) => (
                <li key={i} className="text-sm text-stone-700">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {followUps.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-stone-500">Follow-ups</h4>
            <ul className="space-y-1">
              {followUps.map((item, i) => (
                <li key={i} className="text-sm text-stone-700">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
