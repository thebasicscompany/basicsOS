"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Plus,
  Users,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Avatar,
  AvatarFallback,
  SectionLabel,
  Input,
  Badge,
} from "@basicsos/ui";
import { Search, Mail, Phone, MoreHorizontal, Trash2 } from "@basicsos/ui";
import { DealCard } from "./DealCard";
import { CreateContactDialog } from "./CreateContactDialog";
import { CreateDealDialog } from "./CreateDealDialog";

import type { DealStage } from "./types";

const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-stone-400 dark:bg-stone-500",
  qualified: "bg-blue-500",
  proposal: "bg-amber-500",
  negotiation: "bg-purple-500",
  won: "bg-emerald-500",
  lost: "bg-red-500",
};

const nameToColor = (name: string): string => {
  const colors = [
    "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
    "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length] ?? colors[0] ?? "";
};

const formatCurrency = (value: number): string =>
  value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
      ? `$${(value / 1_000).toFixed(1)}k`
      : `$${value.toLocaleString()}`;

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-stone-100 dark:bg-stone-700">
        <Icon className="size-3.5 text-stone-500 dark:text-stone-400" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
          {label}
        </span>
        <p className="truncate text-sm text-stone-900 dark:text-stone-100">{value}</p>
      </div>
    </div>
  );
}

// Reference layout: title row + pipeline cards + main (list + detail for contacts)
const CRMPage = (): JSX.Element => {
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = (searchParams.get("view") ?? "pipeline") as "pipeline" | "contacts";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const { data: contactsData } = trpc.crm.contacts.list.useQuery({});
  const { data: dealsData } = trpc.crm.deals.listByStage.useQuery();

  const stats = useMemo(() => {
    const contacts = contactsData ?? [];
    const byStage = dealsData ?? [];
    const allDeals = byStage.flatMap((g) => g.deals);
    const pipelineValue = allDeals
      .filter((d) => d.stage !== "won" && d.stage !== "lost")
      .reduce((sum, d) => sum + Number(d.value) || 0, 0);
    const wonValue = allDeals
      .filter((d) => d.stage === "won")
      .reduce((sum, d) => sum + Number(d.value) || 0, 0);
    return {
      contacts: contacts.length,
      deals: allDeals.length,
      pipelineValue,
      wonValue,
    };
  }, [contactsData, dealsData]);

  const filteredContacts = useMemo(() => {
    const list = contactsData ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [contactsData, searchQuery]);

  const selectedContact =
    selectedContactId != null
      ? (contactsData ?? []).find((c) => c.id === selectedContactId)
      : null;

  const setView = (v: "pipeline" | "contacts"): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.push(`?${params.toString()}`);
    setSelectedContactId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title row — breadcrumb already shows "CRM", so only subtitle + action */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Manage your contacts and pipeline
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-stone-500 dark:text-stone-400"
            onClick={() => router.push("/crm/trash")}
          >
            <Trash2 size={14} className="mr-1.5" />
            Trash
          </Button>
          {view === "contacts" ? (
            <CreateContactDialog onCreated={() => void utils.crm.contacts.list.invalidate()}>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus size={16} className="mr-1.5" />
                Add Contact
              </Button>
            </CreateContactDialog>
          ) : (
            <CreateDealDialog onCreated={() => void utils.crm.deals.listByStage.invalidate()}>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus size={16} className="mr-1.5" />
                New Deal
              </Button>
            </CreateDealDialog>
          )}
        </div>
      </div>

      {/* Pipeline overview — 4 compact stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pipeline value</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatCurrency(stats.pipelineValue)}</p>
            <Badge variant="secondary" className="mt-1.5 inline-flex h-5 text-[10px] px-1.5 py-0">{stats.deals} deals</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deals</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{stats.deals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contacts</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{stats.contacts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Won</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-success">{formatCurrency(stats.wonValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* View tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "pipeline" && (
        <div className="overflow-x-auto -mx-1">
          <div className="flex gap-4 min-w-max pb-4">
            {STAGES.map((stage) => {
              const stageGroup = (dealsData ?? []).find((g) => g.stage === stage);
              const stageDeals = stageGroup?.deals ?? [];
              return (
                <div key={stage} className="w-52 flex-shrink-0">
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${STAGE_COLORS[stage] ?? "bg-stone-400"}`}
                    />
                    <SectionLabel as="span" className="!mb-0 flex-1">
                      {stage}
                    </SectionLabel>
                    <span className="rounded-full bg-stone-200 dark:bg-stone-700 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:text-stone-400">
                      {stageDeals.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {stageDeals.length === 0 ? (
                      <div className="rounded-sm border-2 border-dashed border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30 py-8 px-4 text-center">
                        <p className="text-xs text-stone-500 dark:text-stone-400">No deals</p>
                        <p className="mt-1 text-[10px] text-stone-400 dark:text-stone-500">
                          Drag or create a deal
                        </p>
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

      {view === "contacts" &&
        ((contactsData ?? []).length === 0 ? (
          <EmptyState
            Icon={Users}
            heading="No contacts yet"
            description="Add your first contact to get started."
            action={
              <CreateContactDialog onCreated={() => void utils.crm.contacts.list.invalidate()}>
                <Button>
                  <Plus size={14} className="mr-1" /> Add Contact
                </Button>
              </CreateContactDialog>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Contact list card — reference: search + list */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-500 dark:text-stone-400"
                    />
                    <Input
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800/50 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col divide-y divide-border">
                  {filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedContactId(c.id)}
                      className={`flex items-center gap-3 px-2 py-2.5 text-left transition-colors rounded-md hover:bg-accent/50 ${
                        selectedContactId === c.id ? "bg-accent" : ""
                      }`}
                    >
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback
                          className={`text-xs font-medium ${nameToColor(c.name)}`}
                        >
                          {c.name[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{c.email ?? "\u2014"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contact detail card — reference: avatar, name, details, actions */}
            {selectedContact ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-foreground">
                      Contact Details
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground"
                      onClick={() => router.push(`/crm/${selectedContact.id}`)}
                      aria-label="Open full profile"
                    >
                      <MoreHorizontal size={16} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col items-center gap-2 border-b border-border pb-4">
                    <Avatar className="size-12">
                      <AvatarFallback
                        className={`text-sm font-semibold ${nameToColor(selectedContact.name)}`}
                      >
                        {selectedContact.name[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <p className="font-medium text-foreground">{selectedContact.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedContact.email ?? "\u2014"}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <DetailRow
                      icon={Mail}
                      label="Email"
                      value={selectedContact.email ?? "\u2014"}
                    />
                    <DetailRow
                      icon={Phone}
                      label="Phone"
                      value={selectedContact.phone ?? "\u2014"}
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <a href={`mailto:${selectedContact.email ?? ""}`}>
                        <Mail size={14} className="mr-1.5" />
                        Email
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-stone-200 dark:border-stone-700"
                      asChild
                    >
                      <a href={`tel:${selectedContact.phone ?? ""}`}>
                        <Phone size={14} className="mr-1.5" />
                        Call
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="flex items-center justify-center min-h-[200px]">
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Select a contact
                </p>
              </Card>
            )}
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
