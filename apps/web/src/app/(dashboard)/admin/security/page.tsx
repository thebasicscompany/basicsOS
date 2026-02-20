"use client";

import { trpc } from "@/lib/trpc";
import {
  PageHeader, Card, CardHeader, CardTitle,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  EmptyState, Shield,
} from "@basicsos/ui";

// Next.js App Router requires default export — framework exception
const SecurityPage = (): JSX.Element => {
  const { data: log, isLoading } = trpc.admin.getAuditLog.useQuery({ limit: 50 });

  return (
    <div>
      <PageHeader
        title="Security & Audit Log"
        description="Review recent activity across your workspace."
        className="mb-6"
      />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="h-4 w-32 rounded bg-stone-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-stone-200 animate-pulse" />
                </div>
                <div className="h-3 w-20 rounded bg-stone-200 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (log?.events.length ?? 0) === 0 ? (
          <EmptyState
            Icon={Shield}
            heading="No audit events yet"
            description="Activity across your workspace will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log?.events.map((event, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs text-stone-700">{event.type}</TableCell>
                  <TableCell className="text-stone-500">{event.userEmail}</TableCell>
                  <TableCell className="text-right text-stone-500 text-xs">
                    {new Date(event.timestamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default SecurityPage;
