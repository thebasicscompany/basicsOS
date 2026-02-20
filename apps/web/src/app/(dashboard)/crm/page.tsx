"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Button, Plus, Users, EmptyState, PageHeader,
  Tabs, TabsList, TabsTrigger, TabsContent, Card,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Avatar, AvatarFallback,
} from "@basicsos/ui";
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
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mb-6">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "pipeline" && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {STAGES.map((stage) => {
              const stageGroup = (dealsData ?? []).find((g) => g.stage === stage);
              const stageDeals = stageGroup?.deals ?? [];
              return (
                <div key={stage} className="w-48 flex-shrink-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STAGE_COLORS[stage] ?? "bg-stone-400"}`} />
                    <span className="text-xs font-semibold uppercase text-stone-500">{stage}</span>
                    <span className="ml-auto rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-500">{stageDeals.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {stageDeals.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-stone-200 py-8 px-4 text-center">
                        <p className="text-xs text-stone-500">No deals</p>
                        <p className="mt-1 text-[10px] text-stone-300">Drag or create a deal</p>
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
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="p-3">Name</TableHead>
                  <TableHead className="p-3">Email</TableHead>
                  <TableHead className="p-3">Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(contactsData ?? []).map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/crm/${c.id}`)}>
                    <TableCell className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className={`text-xs font-semibold ${nameToColor(c.name)}`}>
                            {c.name[0]?.toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-stone-900">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-stone-600">{c.email ?? "\u2014"}</TableCell>
                    <TableCell className="p-3 text-stone-600">{c.phone ?? "\u2014"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
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
