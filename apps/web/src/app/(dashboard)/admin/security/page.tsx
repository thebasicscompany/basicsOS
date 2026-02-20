"use client";

import { trpc } from "@/lib/trpc";

// Next.js App Router requires default export — framework exception
const SecurityPage = (): JSX.Element => {
  const { data: log, isLoading } = trpc.admin.getAuditLog.useQuery({ limit: 50 });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Security & Audit Log</h1>
        <p className="mt-1 text-sm text-stone-500">Review recent activity across your workspace.</p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Recent Events</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-stone-400">Loading…</div>
        ) : (log?.events.length ?? 0) === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-stone-400">No audit events yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs font-medium text-stone-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {log?.events.map((event, i) => (
                <tr key={i} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-mono text-xs text-stone-700">{event.type}</td>
                  <td className="px-4 py-3 text-stone-500">{event.userEmail}</td>
                  <td className="px-4 py-3 text-right text-stone-400 text-xs">
                    {new Date(event.timestamp).toLocaleString()}
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

export default SecurityPage;
