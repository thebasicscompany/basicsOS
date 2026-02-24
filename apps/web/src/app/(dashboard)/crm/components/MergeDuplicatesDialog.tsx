"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Badge,
  Card,
  CardContent,
  addToast,
  cn,
  GitMerge,
  Mail,
  Globe,
} from "@basicsos/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContactDupePair {
  id1: string;
  name1: string;
  email1: string | null;
  id2: string;
  name2: string;
  email2: string | null;
  reason: string;
}

export interface CompanyDupePair {
  id1: string;
  name1: string;
  domain1: string | null;
  id2: string;
  name2: string;
  domain2: string | null;
  reason: string;
}

interface MergeContactDialogProps {
  entity: "contact";
  pair: ContactDupePair;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

interface MergeCompanyDialogProps {
  entity: "company";
  pair: CompanyDupePair;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

export type MergeDuplicatesDialogProps = MergeContactDialogProps | MergeCompanyDialogProps;

// ---------------------------------------------------------------------------
// Field choice type
// ---------------------------------------------------------------------------

type FieldChoice = "winner" | "loser";

// ---------------------------------------------------------------------------
// FieldSelector — radio-style button pair
// ---------------------------------------------------------------------------

function FieldSelector({
  label,
  winnerValue,
  loserValue,
  field,
  choice,
  onChange,
}: {
  label: string;
  winnerValue: string | null;
  loserValue: string | null;
  field: string;
  choice: FieldChoice;
  onChange: (field: string, val: FieldChoice) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(field, "winner")}
          className={cn(
            "flex-1 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
            choice === "winner"
              ? "border-primary bg-primary/10 text-stone-900 dark:text-stone-100"
              : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300",
          )}
        >
          {winnerValue ?? "—"}
        </button>
        <button
          type="button"
          onClick={() => onChange(field, "loser")}
          className={cn(
            "flex-1 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
            choice === "loser"
              ? "border-primary bg-primary/10 text-stone-900 dark:text-stone-100"
              : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300",
          )}
        >
          {loserValue ?? "—"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact merge dialog
// ---------------------------------------------------------------------------

function MergeContactDialog({
  pair,
  open,
  onOpenChange,
  onMerged,
}: Omit<MergeContactDialogProps, "entity">): JSX.Element {
  const [winnerId, setWinnerId] = useState<string>(pair.id1);
  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldChoice>>({
    name: "winner",
    email: "winner",
    phone: "winner",
  });

  const loserId = winnerId === pair.id1 ? pair.id2 : pair.id1;
  const winnerName = winnerId === pair.id1 ? pair.name1 : pair.name2;
  const loserName = loserId === pair.id1 ? pair.name1 : pair.name2;
  const winnerEmail = winnerId === pair.id1 ? pair.email1 : pair.email2;
  const loserEmail = loserId === pair.id1 ? pair.email1 : pair.email2;

  const setFieldChoice = (field: string, val: FieldChoice): void => {
    setFieldChoices((prev) => ({ ...prev, [field]: val }));
  };

  const mergeMutation = trpc.crm.contacts.merge.useMutation({
    onSuccess: () => {
      addToast({ title: "Contacts merged", variant: "success" });
      onOpenChange(false);
      onMerged();
    },
    onError: (err) => {
      addToast({ title: "Merge failed", description: err.message, variant: "destructive" });
    },
  });

  const handleMerge = (): void => {
    mergeMutation.mutate({
      winnerId,
      loserId,
      keepFields: {
        name: fieldChoices["name"] as FieldChoice,
        email: fieldChoices["email"] as FieldChoice,
        phone: fieldChoices["phone"] as FieldChoice,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge size={18} className="text-primary" />
            Merge Duplicate Contacts
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Reason badge */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {pair.reason === "email" ? "Same email" : "Similar name"}
            </Badge>
          </div>

          {/* Winner selection */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-stone-500">Select the record to keep:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: pair.id1, name: pair.name1, email: pair.email1 },
                { id: pair.id2, name: pair.name2, email: pair.email2 },
              ].map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setWinnerId(rec.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    winnerId === rec.id
                      ? "border-primary bg-primary/5"
                      : "border-stone-200 dark:border-stone-700 hover:border-stone-300",
                  )}
                >
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    {rec.name}
                  </p>
                  {rec.email !== null && rec.email !== undefined && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                      <Mail size={10} />
                      {rec.email}
                    </p>
                  )}
                  {winnerId === rec.id && (
                    <Badge variant="default" className="mt-1.5 text-[10px] px-1.5 py-0">
                      Keep
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Field choices */}
          <Card>
            <CardContent className="flex flex-col gap-3 pt-4">
              <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Choose which values to keep:
              </p>
              <div className="mb-1 grid grid-cols-2 gap-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                <span className="pl-1">{winnerName} (keep)</span>
                <span className="pl-1">{loserName} (discard)</span>
              </div>
              <FieldSelector
                label="Name"
                field="name"
                winnerValue={winnerName}
                loserValue={loserName}
                choice={fieldChoices["name"] as FieldChoice}
                onChange={setFieldChoice}
              />
              <FieldSelector
                label="Email"
                field="email"
                winnerValue={winnerEmail}
                loserValue={loserEmail}
                choice={fieldChoices["email"] as FieldChoice}
                onChange={setFieldChoice}
              />
              <FieldSelector
                label="Phone"
                field="phone"
                winnerValue={null}
                loserValue={null}
                choice={fieldChoices["phone"] as FieldChoice}
                onChange={setFieldChoice}
              />
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={mergeMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mergeMutation.isPending ? "Merging…" : "Merge Contacts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Company merge dialog
// ---------------------------------------------------------------------------

function MergeCompanyDialog({
  pair,
  open,
  onOpenChange,
  onMerged,
}: Omit<MergeCompanyDialogProps, "entity">): JSX.Element {
  const [winnerId, setWinnerId] = useState<string>(pair.id1);
  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldChoice>>({
    name: "winner",
    domain: "winner",
    industry: "winner",
  });

  const loserId = winnerId === pair.id1 ? pair.id2 : pair.id1;
  const winnerName = winnerId === pair.id1 ? pair.name1 : pair.name2;
  const loserName = loserId === pair.id1 ? pair.name1 : pair.name2;
  const winnerDomain = winnerId === pair.id1 ? pair.domain1 : pair.domain2;
  const loserDomain = loserId === pair.id1 ? pair.domain1 : pair.domain2;

  const setFieldChoice = (field: string, val: FieldChoice): void => {
    setFieldChoices((prev) => ({ ...prev, [field]: val }));
  };

  const mergeMutation = trpc.crm.companies.merge.useMutation({
    onSuccess: () => {
      addToast({ title: "Companies merged", variant: "success" });
      onOpenChange(false);
      onMerged();
    },
    onError: (err) => {
      addToast({ title: "Merge failed", description: err.message, variant: "destructive" });
    },
  });

  const handleMerge = (): void => {
    mergeMutation.mutate({
      winnerId,
      loserId,
      keepFields: {
        name: fieldChoices["name"] as FieldChoice,
        domain: fieldChoices["domain"] as FieldChoice,
        industry: fieldChoices["industry"] as FieldChoice,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge size={18} className="text-primary" />
            Merge Duplicate Companies
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {pair.reason === "domain" ? "Same domain" : "Similar name"}
            </Badge>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-stone-500">Select the record to keep:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: pair.id1, name: pair.name1, domain: pair.domain1 },
                { id: pair.id2, name: pair.name2, domain: pair.domain2 },
              ].map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setWinnerId(rec.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    winnerId === rec.id
                      ? "border-primary bg-primary/5"
                      : "border-stone-200 dark:border-stone-700 hover:border-stone-300",
                  )}
                >
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    {rec.name}
                  </p>
                  {rec.domain !== null && rec.domain !== undefined && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                      <Globe size={10} />
                      {rec.domain}
                    </p>
                  )}
                  {winnerId === rec.id && (
                    <Badge variant="default" className="mt-1.5 text-[10px] px-1.5 py-0">
                      Keep
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3 pt-4">
              <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Choose which values to keep:
              </p>
              <div className="mb-1 grid grid-cols-2 gap-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                <span className="pl-1">{winnerName} (keep)</span>
                <span className="pl-1">{loserName} (discard)</span>
              </div>
              <FieldSelector
                label="Name"
                field="name"
                winnerValue={winnerName}
                loserValue={loserName}
                choice={fieldChoices["name"] as FieldChoice}
                onChange={setFieldChoice}
              />
              <FieldSelector
                label="Domain"
                field="domain"
                winnerValue={winnerDomain}
                loserValue={loserDomain}
                choice={fieldChoices["domain"] as FieldChoice}
                onChange={setFieldChoice}
              />
              <FieldSelector
                label="Industry"
                field="industry"
                winnerValue={null}
                loserValue={null}
                choice={fieldChoices["industry"] as FieldChoice}
                onChange={setFieldChoice}
              />
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={mergeMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mergeMutation.isPending ? "Merging…" : "Merge Companies"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Public export — unified component
// ---------------------------------------------------------------------------

export const MergeDuplicatesDialog = (props: MergeDuplicatesDialogProps): JSX.Element => {
  if (props.entity === "contact") {
    return <MergeContactDialog {...props} />;
  }
  return <MergeCompanyDialog {...props} />;
};
