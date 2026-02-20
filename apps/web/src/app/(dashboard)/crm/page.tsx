"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Plus, Users, EmptyState, PageHeader } from "@basicsos/ui";
import { DealCard } from "./DealCard";
import { CreateContactDialog } from "./CreateContactDialog";
import { CreateDealDialog } from "./CreateDealDialog";

import type { DealStage } from "./types";

const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-stone-400",
  qualified: "bg-blue-500",
  proposal: "bg-amber-500",
  negotiation: "bg-purple-500",
  won: "bg-emerald-500",
  lost: "bg-red-500",
};

const nameToColor = (name: string): string => {
  const colors = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length] ?? colors[0] ?? "";
};

// Next.js App Router requires default export — framework exception.
const CRMPage = (): JSX.Element => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = (searchParams.get("view") ?? "pipeline") as "pipeline" | "contacts";

  const { data: contactsData, refetch: refetchContacts } = trpc.crm.contacts.list.useQuery({});
  const { data: dealsData, refetch: refetchDeals } = trpc.crm.deals.listByStage.useQuery();

  const setView = (v: "pipeline" | "contacts"): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.push(`?${params.toString()}`);
  };

  return (
    <div>
      <PageHeader
        title="CRM"
        className="mb-6"
        action={
          view === "contacts" ? (
            <CreateContactDialog onCreated={() => void refetchContacts()}>
              <Button><Plus size={14} className="mr-1" /> New Contact</Button>
            </CreateContactDialog>
          ) : (
            <CreateDealDialog onCreated={() => void refetchDeals()}>
              <Button><Plus size={14} className="mr-1" /> New Deal</Button>
            </CreateDealDialog>
          )
        }
      />

      {/* View tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
        <button
          onClick={() => setView("pipeline")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            view === "pipeline"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Pipeline
        </button>
        <button
          onClick={() => setView("contacts")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            view === "contacts"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Contacts
        </button>
      </div>

      {view === "pipeline" && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {STAGES.map((stage) => {
              const stageGroup = (dealsData ?? []).find((g) => g.stage === stage);
              const stageDeals = stageGroup?.deals ?? [];
              return (
                <div key={stage} className="w-56 flex-shrink-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STAGE_COLORS[stage] ?? "bg-stone-400"}`} />
                    <span className="text-xs font-semibold uppercase text-stone-500">{stage}</span>
                    <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">{stageDeals.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {stageDeals.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-stone-200 p-4 text-center text-xs text-stone-400">
                        No deals
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={{
                            id: deal.id,
                            title: deal.title,
                            stage: deal.stage as DealStage,
                            value: String(deal.value ?? 0),
                            probability: deal.probability,
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "contacts" && (
        (contactsData ?? []).length === 0 ? (
          <EmptyState
            Icon={Users}
            heading="No contacts yet"
            description="Add your first contact to get started."
            action={
              <CreateContactDialog onCreated={() => void refetchContacts()}>
                <Button><Plus size={14} className="mr-1" /> Add Contact</Button>
              </CreateContactDialog>
            }
          />
        ) : (
          <div className="rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left font-medium text-stone-600">Name</th>
                  <th className="p-3 text-left font-medium text-stone-600">Email</th>
                  <th className="p-3 text-left font-medium text-stone-600">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(contactsData ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50 cursor-pointer transition-colors" onClick={() => router.push(`/crm/${c.id}`)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${nameToColor(c.name)}`}>
                          {c.name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="font-medium text-stone-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-stone-600">{c.email ?? "\u2014"}</td>
                    <td className="p-3 text-stone-600">{c.phone ?? "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};

const CRMPageWrapper = (): JSX.Element => (
  <Suspense>
    <CRMPage />
  </Suspense>
);

export default CRMPageWrapper;
