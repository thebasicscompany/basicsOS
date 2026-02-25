"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Switch,
  EmptyState,
  PageHeader,
  Zap,
  Plus,
  addToast,
} from "@basicsos/ui";
import { getTriggerLabel } from "./trigger-meta";

const formatRelative = (date: Date | string | null): string => {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// Next.js App Router requires default export — framework exception.
const AutomationsPage = (): JSX.Element => {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.automations.list.useQuery();

  const createAndGoToFlow = trpc.automations.create.useMutation({
    onSuccess: (automation) => {
      void utils.automations.list.invalidate();
      router.push(`/automations/${automation.id}/flow`);
    },
    onError: (err) => {
      addToast({ title: "Failed to create automation", description: err.message, variant: "destructive" });
    },
  });

  const setEnabled = trpc.automations.setEnabled.useMutation({
    onSuccess: () => void utils.automations.list.invalidate(),
    onError: (err) => addToast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const automationList = data ?? [];

  const handleNewAutomation = (): void => {
    createAndGoToFlow.mutate({
      name: "Untitled Automation",
      triggerConfig: { eventType: "task.created", conditions: [] },
      actionChain: [],
      enabled: false,
    });
  };

  return (
    <div>
      <PageHeader
        title="Automations"
        description="Trigger actions automatically when business events occur."
        className="mb-6"
        action={
          <Button onClick={handleNewAutomation} disabled={createAndGoToFlow.isPending}>
            <Plus size={14} className="mr-1" /> New Automation
          </Button>
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                  <div className="h-4 w-48 rounded bg-stone-200 dark:bg-stone-700" />
                  <div className="h-5 w-28 rounded-full bg-stone-200 dark:bg-stone-700" />
                  <div className="ml-auto h-5 w-16 rounded bg-stone-200 dark:bg-stone-700" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : automationList.length === 0 ? (
        <EmptyState
          Icon={Zap}
          heading="No automations yet"
          description="Create an automation and build your trigger and actions in the visual flow."
          action={
            <Button onClick={handleNewAutomation} disabled={createAndGoToFlow.isPending}>
              <Plus size={14} className="mr-1" /> New Automation
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead className="w-20 text-right">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automationList.map((automation) => {
                const triggerConfig = automation.triggerConfig as { eventType?: string } | null;
                const actionChain = Array.isArray(automation.actionChain) ? automation.actionChain : [];

                return (
                  <TableRow
                    key={automation.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/automations/${automation.id}`)}
                  >
                    <TableCell className="font-medium text-stone-900 dark:text-stone-100">{automation.name}</TableCell>
                    <TableCell>
                      {triggerConfig?.eventType ? (
                        <Badge variant="secondary">{getTriggerLabel(triggerConfig.eventType)}</Badge>
                      ) : (
                        <span className="text-stone-400 dark:text-stone-500 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-stone-500 dark:text-stone-400 text-sm">
                      {actionChain.length === 0
                        ? <span className="italic text-stone-400 dark:text-stone-500">None</span>
                        : `${actionChain.length} action${actionChain.length !== 1 ? "s" : ""}`}
                    </TableCell>
                    <TableCell className="text-stone-400 dark:text-stone-500 text-sm">
                      {formatRelative(automation.lastRunAt)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={automation.enabled}
                        onCheckedChange={(enabled) =>
                          setEnabled.mutate({ id: automation.id, enabled })
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default AutomationsPage;
