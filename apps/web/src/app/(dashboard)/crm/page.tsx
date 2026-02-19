"use client";

import { trpc } from "@/lib/trpc";

const stages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
const stageColors: Record<string, string> = {
  lead: "bg-gray-100 text-gray-700",
  qualified: "bg-blue-100 text-blue-700",
  proposal: "bg-yellow-100 text-yellow-700",
  negotiation: "bg-orange-100 text-orange-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

// Next.js App Router requires default exports for page segments.
const CRMPage = (): JSX.Element => {
  const { data: pipeline, isLoading: pipelineLoading } = trpc.crm.deals.listByStage.useQuery();
  const { data: contactList, isLoading: contactsLoading } = trpc.crm.contacts.list.useQuery({ limit: 50 });

  if (pipelineLoading || contactsLoading) {
    return <div className="p-8 text-center text-gray-400">Loading CRM...</div>;
  }

  const pipelineByStage = new Map(
    (pipeline ?? []).map((g) => [g.stage, g.deals]),
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">CRM</h1>
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Pipeline</h2>
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {stages.map((stage) => {
              const stageDeals = pipelineByStage.get(stage) ?? [];
              return (
                <div key={stage} className="w-56 flex-shrink-0">
                  <div className="mb-2 text-xs font-semibold uppercase text-gray-500">
                    {stage} ({stageDeals.length})
                  </div>
                  <div className="space-y-2">
                    {stageDeals.map((deal) => (
                      <div key={deal.id} className="rounded-lg border bg-white p-3 shadow-sm">
                        <div className="font-medium text-sm text-gray-900">{deal.title}</div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${stageColors[deal.stage] ?? "bg-gray-100"}`}>
                            {deal.stage}
                          </span>
                          <span className="text-xs font-medium text-gray-600">
                            ${Number(deal.value).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-700">
          Contacts ({(contactList ?? []).length})
        </h2>
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left font-medium text-gray-600">Name</th>
                <th className="p-3 text-left font-medium text-gray-600">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(contactList ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900">{c.name}</td>
                  <td className="p-3 text-gray-600">{c.email ?? "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CRMPage;
