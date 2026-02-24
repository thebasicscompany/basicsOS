"use client";

import { trpc } from "@/lib/trpc";
import {
  Card, CardContent, CardHeader, CardTitle, PageHeader,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  EmptyState, ChartBar,
} from "@basicsos/ui";

// Next.js App Router requires default export — framework exception
const UsagePage = (): JSX.Element => {
  const { data: stats, isLoading } = trpc.admin.getUsageStats.useQuery();

  return (
    <div>
      <PageHeader
        title="AI Usage"
        description="Monitor AI usage and costs across your team."
        className="mb-6"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Requests This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{stats?.requestsThisMonth ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tokens Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {(stats?.tokensThisMonth ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Est. Cost (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              ${(stats?.estimatedCostUsd ?? 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent AI Calls</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-4">
                  <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-28 rounded bg-muted animate-pulse" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (stats?.recentCalls.length ?? 0) === 0 ? (
          <EmptyState
            Icon={ChartBar}
            heading="No data yet"
            description="AI usage will appear here once your team starts using AI features."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.recentCalls.map((call, i) => (
                <TableRow key={i}>
                  <TableCell className="text-foreground">{call.userId ?? "\u2014"}</TableCell>
                  <TableCell className="text-muted-foreground">{call.model}</TableCell>
                  <TableCell className="text-right text-foreground tabular-nums">{call.tokens}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {new Date(call.timestamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsagePage;
