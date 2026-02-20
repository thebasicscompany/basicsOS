"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@basicsos/ui";

// Next.js App Router requires default export — framework exception
const UsagePage = (): JSX.Element => {
  const { data: stats, isLoading } = trpc.admin.getUsageStats.useQuery();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">AI Usage</h1>
        <p className="mt-1 text-sm text-stone-500">Monitor AI usage and costs across your team.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-stone-500">
              Requests This Month
            </CardTitle>
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

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-700">Recent AI Calls</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-stone-400">Loading…</div>
        ) : (stats?.recentCalls.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-sm text-stone-400">No data yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs font-medium text-stone-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-right">Tokens</th>
                <th className="px-4 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {stats?.recentCalls.map((call, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-stone-900">{call.userId ?? "—"}</td>
                  <td className="px-4 py-3 text-stone-500">{call.model}</td>
                  <td className="px-4 py-3 text-right text-stone-900">{call.tokens}</td>
                  <td className="px-4 py-3 text-right text-stone-500">
                    {new Date(call.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UsagePage;
