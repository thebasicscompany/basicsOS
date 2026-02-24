"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  addToast,
  Trash,
  ArrowCounterClockwise,
  Users,
  Buildings,
  CurrencyDollar,
} from "@basicsos/ui";

type EntityType = "contact" | "company" | "deal";

interface PurgeTarget {
  entity: EntityType;
  id: string;
  name: string;
}

const formatDeletedAt = (date: Date | string | null): string => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function TrashPage(): JSX.Element {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null);

  const { data, isLoading } = trpc.crm.trash.list.useQuery();

  const restoreMutation = trpc.crm.trash.restore.useMutation({
    onSuccess: (_result, variables) => {
      addToast({
        title: "Restored",
        description: `${variables.entity} has been restored.`,
        variant: "success",
      });
      void utils.crm.trash.list.invalidate();
      void utils.crm.contacts.list.invalidate();
      void utils.crm.companies.list.invalidate();
      void utils.crm.deals.listByStage.invalidate();
    },
    onError: (err) => {
      addToast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const purgeMutation = trpc.crm.trash.purge.useMutation({
    onSuccess: () => {
      addToast({ title: "Permanently deleted", variant: "success" });
      setPurgeTarget(null);
      void utils.crm.trash.list.invalidate();
    },
    onError: (err) => {
      addToast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleRestore = (entity: EntityType, id: string): void => {
    restoreMutation.mutate({ entity, id });
  };

  const handlePurgeConfirm = (): void => {
    if (!purgeTarget) return;
    purgeMutation.mutate({ entity: purgeTarget.entity, id: purgeTarget.id });
  };

  const deletedContacts = data?.contacts ?? [];
  const deletedCompanies = data?.companies ?? [];
  const deletedDeals = data?.deals ?? [];

  const totalCount = deletedContacts.length + deletedCompanies.length + deletedDeals.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Deleted records are kept for 30 days before being permanently removed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalCount} item{totalCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => router.push("/crm")}>
            Back to CRM
          </Button>
        </div>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">
            Contacts
            {deletedContacts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                {deletedContacts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="companies">
            Companies
            {deletedCompanies.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                {deletedCompanies.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deals">
            Deals
            {deletedDeals.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                {deletedDeals.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4">
          {isLoading ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Loading...</p>
          ) : deletedContacts.length === 0 ? (
            <EmptyState
              Icon={Users}
              heading="No deleted contacts"
              description="Contacts you delete will appear here for 30 days."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="text-stone-500 dark:text-stone-400">
                      {contact.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-stone-500 dark:text-stone-400">
                      {formatDeletedAt(contact.deletedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore("contact", contact.id)}
                          disabled={restoreMutation.isPending}
                        >
                          <ArrowCounterClockwise size={14} className="mr-1.5" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setPurgeTarget({ entity: "contact", id: contact.id, name: contact.name })
                          }
                        >
                          <Trash size={14} className="mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="companies" className="mt-4">
          {isLoading ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Loading...</p>
          ) : deletedCompanies.length === 0 ? (
            <EmptyState
              Icon={Buildings}
              heading="No deleted companies"
              description="Companies you delete will appear here for 30 days."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-stone-500 dark:text-stone-400">
                      {company.domain ?? "—"}
                    </TableCell>
                    <TableCell className="text-stone-500 dark:text-stone-400">
                      {formatDeletedAt(company.deletedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore("company", company.id)}
                          disabled={restoreMutation.isPending}
                        >
                          <ArrowCounterClockwise size={14} className="mr-1.5" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setPurgeTarget({
                              entity: "company",
                              id: company.id,
                              name: company.name,
                            })
                          }
                        >
                          <Trash size={14} className="mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="deals" className="mt-4">
          {isLoading ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Loading...</p>
          ) : deletedDeals.length === 0 ? (
            <EmptyState
              Icon={CurrencyDollar}
              heading="No deleted deals"
              description="Deals you delete will appear here for 30 days."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedDeals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="font-medium">{deal.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {deal.stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-stone-500 dark:text-stone-400">
                      {formatDeletedAt(deal.deletedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore("deal", deal.id)}
                          disabled={restoreMutation.isPending}
                        >
                          <ArrowCounterClockwise size={14} className="mr-1.5" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setPurgeTarget({ entity: "deal", id: deal.id, name: deal.title })
                          }
                        >
                          <Trash size={14} className="mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {/* Purge confirmation dialog */}
      <Dialog open={purgeTarget !== null} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            <strong className="text-stone-900 dark:text-stone-100">{purgeTarget?.name}</strong> will
            be permanently deleted and cannot be recovered. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurgeConfirm}
              disabled={purgeMutation.isPending}
            >
              <Trash size={14} className="mr-1.5" />
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
