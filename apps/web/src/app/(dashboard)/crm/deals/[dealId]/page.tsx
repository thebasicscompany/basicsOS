"use client";

import { use, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  PageHeader,
  Card,
  CardContent,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  addToast,
  cn,
  Input,
} from "@basicsos/ui";
import { Building2, Users, Calendar, DollarSign, BarChart3, Activity, Trash2, Bell } from "@basicsos/ui";
import { CrmSummaryCard } from "../../components/CrmSummaryCard";
import { CrmFieldGrid } from "../../components/CrmFieldGrid";
import { DealActivitiesPanel } from "./DealActivitiesPanel";
import { EditDealDialog } from "../../EditDealDialog";
import { STAGES, STAGE_COLORS, formatCurrency } from "../../utils";

interface DealDetailPageProps {
  params: Promise<{ dealId: string }>;
}

const DealDetailPage = ({ params }: DealDetailPageProps): JSX.Element => {
  const { dealId } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: deal, isLoading, error } = trpc.crm.deals.get.useQuery({ id: dealId });
  const { data: contactData } = trpc.crm.contacts.get.useQuery(
    { id: deal?.contactId ?? "" },
    { enabled: !!deal?.contactId },
  );
  const { data: companyData } = trpc.crm.companies.get.useQuery(
    { id: deal?.companyId ?? "" },
    { enabled: !!deal?.companyId },
  );

  if (isLoading) {
    return <DealDetailSkeleton />;
  }
  if (error ?? !deal) {
    notFound();
  }

  const fields = [
    { icon: DollarSign, label: "Value", value: formatCurrency(Number(deal.value ?? 0)) },
    { icon: BarChart3, label: "Probability", value: `${deal.probability ?? 50}%` },
    { icon: Activity, label: "Stage", value: deal.stage.charAt(0).toUpperCase() + deal.stage.slice(1) },
    ...(deal.closeDate
      ? [{ icon: Calendar, label: "Close Date", value: new Date(deal.closeDate).toLocaleDateString() }]
      : []),
    ...(contactData
      ? [{ icon: Users, label: "Contact", value: contactData.name, href: `/crm/contacts/${contactData.id}` }]
      : []),
    ...(companyData
      ? [{ icon: Building2, label: "Company", value: companyData.name, href: `/crm/companies/${companyData.id}` }]
      : []),
  ];

  const stageColor = STAGE_COLORS[deal.stage] ?? "bg-stone-400";
  const subtitleNode = (
    <div className="flex items-center gap-1.5 mt-1">
      <span className={`size-2 rounded-full ${stageColor}`} />
      <Badge variant="outline" className="capitalize text-xs">{deal.stage}</Badge>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={deal.title}
        backHref="/crm/deals"
        backLabel="Deals"
        action={
          <div className="flex gap-2">
            <SetReminderButton dealId={deal.id} />
            <EditDealDialog deal={deal} onUpdated={() => void utils.crm.deals.get.invalidate({ id: dealId })}>
              <Button variant="outline" size="sm">Edit</Button>
            </EditDealDialog>
            <DeleteDealButton dealId={deal.id} router={router} />
          </div>
        }
      />
      <StageProgressBar currentStage={deal.stage} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CrmSummaryCard
          name={deal.title}
          subtitleNode={subtitleNode}
        />
        <div className="lg:col-span-2 flex flex-col gap-6">
          <CrmFieldGrid title="Details" fields={fields} />
          <DealActivitiesPanel dealId={dealId} activities={deal.activities} />
        </div>
      </div>
    </div>
  );
};

function StageProgressBar({ currentStage }: { currentStage: string }): JSX.Element {
  const activeIdx = STAGES.indexOf(currentStage as (typeof STAGES)[number]);

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-1">
          {STAGES.filter((s) => s !== "lost").map((stage, i) => {
            const color = STAGE_COLORS[stage] ?? "bg-stone-400";
            const isActive = i <= activeIdx;
            const isCurrent = stage === currentStage;
            return (
              <div key={stage} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    "h-1.5 w-full rounded-full transition-colors",
                    isActive ? color : "bg-stone-200 dark:bg-stone-700",
                  )}
                />
                <span className={cn(
                  "text-[10px] capitalize",
                  isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                )}>
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DealDetailSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-48 animate-pulse rounded-md bg-stone-200 dark:bg-stone-700" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="py-6">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="h-32 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SetReminderButton({ dealId }: { dealId: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [remindAt, setRemindAt] = useState("");
  const [message, setMessage] = useState("");

  const createReminder = trpc.crm.reminders.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Reminder set", variant: "success" });
      setOpen(false);
      setRemindAt("");
      setMessage("");
    },
    onError: (err) => {
      addToast({ title: "Failed to set reminder", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (): void => {
    if (!remindAt) return;
    createReminder.mutate({
      entity: "deal",
      recordId: dealId,
      remindAt: new Date(remindAt).toISOString(),
      message: message.trim() || undefined,
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Bell size={14} className="mr-1" /> Set Reminder
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Reminder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="remind-at">
                Remind at
              </label>
              <Input
                id="remind-at"
                type="datetime-local"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="reminder-message">
                Message (optional)
              </label>
              <textarea
                id="reminder-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a note for this reminder..."
                maxLength={500}
                rows={3}
                className="w-full rounded-md border border-stone-200 bg-background px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ring dark:border-stone-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!remindAt || createReminder.isPending}
            >
              {createReminder.isPending ? "Saving..." : "Set Reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteDealButton({
  dealId,
  router,
}: {
  dealId: string;
  router: ReturnType<typeof useRouter>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const deleteDeal = trpc.crm.deals.delete.useMutation({
    onSuccess: () => {
      addToast({ title: "Deal deleted", variant: "success" });
      router.push("/crm/deals");
    },
    onError: (err) => {
      addToast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 size={14} className="mr-1" /> Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Deal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteDeal.mutate({ id: dealId })} disabled={deleteDeal.isPending}>
              {deleteDeal.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DealDetailPage;
