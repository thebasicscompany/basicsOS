"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  AlertTriangle,
  GitMerge,
  X,
  cn,
} from "@basicsos/ui";
import {
  MergeDuplicatesDialog,
  type ContactDupePair,
  type CompanyDupePair,
} from "./MergeDuplicatesDialog";

// ---------------------------------------------------------------------------
// ContactDuplicatesPanel
// ---------------------------------------------------------------------------

export const ContactDuplicatesPanel = (): JSX.Element | null => {
  const utils = trpc.useUtils();
  const { data: dupes } = trpc.crm.contacts.findDuplicates.useQuery();
  const [dismissed, setDismissed] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<ContactDupePair | null>(null);

  if (dismissed || !dupes || dupes.length === 0) return null;

  const handleMerged = (): void => {
    void utils.crm.contacts.findDuplicates.invalidate();
    void utils.crm.contacts.list.invalidate();
  };

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {dupes.length} potential duplicate contact{dupes.length !== 1 ? "s" : ""} found
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0">
          {dupes.map((pair) => (
            <div
              key={`${pair.id1}-${pair.id2}`}
              className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-white px-3 py-2 dark:border-amber-900/40 dark:bg-stone-900/40"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    "shrink-0 text-[10px]",
                    pair.reason === "email"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
                  )}
                >
                  {pair.reason === "email" ? "email" : "name"}
                </Badge>
                <span className="truncate text-xs text-stone-700 dark:text-stone-300">
                  <span className="font-medium">{pair.name1}</span>
                  <span className="mx-1 text-stone-400">vs</span>
                  <span className="font-medium">{pair.name2}</span>
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1 border-amber-300 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
                onClick={() => setMergeTarget(pair)}
              >
                <GitMerge size={12} />
                Merge
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {mergeTarget !== null && (
        <MergeDuplicatesDialog
          entity="contact"
          pair={mergeTarget}
          open={mergeTarget !== null}
          onOpenChange={(open) => { if (!open) setMergeTarget(null); }}
          onMerged={handleMerged}
        />
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// CompanyDuplicatesPanel
// ---------------------------------------------------------------------------

export const CompanyDuplicatesPanel = (): JSX.Element | null => {
  const utils = trpc.useUtils();
  const { data: dupes } = trpc.crm.companies.findDuplicates.useQuery();
  const [dismissed, setDismissed] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<CompanyDupePair | null>(null);

  if (dismissed || !dupes || dupes.length === 0) return null;

  const handleMerged = (): void => {
    void utils.crm.companies.findDuplicates.invalidate();
    void utils.crm.companies.list.invalidate();
  };

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {dupes.length} potential duplicate {dupes.length !== 1 ? "companies" : "company"} found
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0">
          {dupes.map((pair) => (
            <div
              key={`${pair.id1}-${pair.id2}`}
              className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-white px-3 py-2 dark:border-amber-900/40 dark:bg-stone-900/40"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    "shrink-0 text-[10px]",
                    pair.reason === "domain"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
                  )}
                >
                  {pair.reason === "domain" ? "domain" : "name"}
                </Badge>
                <span className="truncate text-xs text-stone-700 dark:text-stone-300">
                  <span className="font-medium">{pair.name1}</span>
                  <span className="mx-1 text-stone-400">vs</span>
                  <span className="font-medium">{pair.name2}</span>
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1 border-amber-300 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
                onClick={() => setMergeTarget(pair)}
              >
                <GitMerge size={12} />
                Merge
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {mergeTarget !== null && (
        <MergeDuplicatesDialog
          entity="company"
          pair={mergeTarget}
          open={mergeTarget !== null}
          onOpenChange={(open) => { if (!open) setMergeTarget(null); }}
          onMerged={handleMerged}
        />
      )}
    </>
  );
};
