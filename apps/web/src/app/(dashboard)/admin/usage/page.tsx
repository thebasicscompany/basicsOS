"use client";

import { trpc } from "@/lib/trpc";
import {
  Card, CardContent, CardHeader, CardTitle, PageHeader,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  EmptyState, BarChart3,
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
            <CardTitle className="text-sm font-medium text-stone-500">Requests This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-stone-900">{stats?.requestsThisMonth ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-stone-500">Tokens Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-stone-900">
              {(stats?.tokensThisMonth ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-stone-500">Est. Cost (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-stone-900">
              ${(stats?.estimatedCostUsd ?? 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Recent AI Calls</CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="h-4 w-20 rounded bg-stone-200 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-stone-200 animate-pulse" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-4 w-16 rounded bg-stone-200 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-stone-200 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (stats?.recentCalls.length ?? 0) === 0 ? (
          <EmptyState
            Icon={BarChart3}
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
                  <TableCell className="text-stone-900">{call.userId ?? "\u2014"}</TableCell>
                  <TableCell className="text-stone-500">{call.model}</TableCell>
                  <TableCell className="text-right text-stone-900">{call.tokens}</TableCell>
                  <TableCell className="text-right text-stone-500">
                    {new Date(call.timestamp).toLocaleString()}
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

export default UsagePage;
