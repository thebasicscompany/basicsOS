"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@basicsos/ui";
import { Trash2 } from "@basicsos/ui";

interface CrmBulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  extraActions?: React.ReactNode;
}

export function CrmBulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  isDeleting = false,
  extraActions,
}: CrmBulkActionBarProps): JSX.Element | null {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-lg border border-stone-200 bg-paper px-4 py-2.5 shadow-lg dark:border-stone-700">
        <span className="text-sm font-medium text-foreground">{selectedCount} selected</span>
        <div className="flex items-center gap-1 text-xs">
          {selectedCount < totalCount && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onSelectAll}>Select all</Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onDeselectAll}>Deselect</Button>
        </div>
        <div className="h-4 w-px bg-border" />
        {extraActions}
        <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="size-3" /> Delete
        </Button>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Delete {selectedCount} record{selectedCount !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => { onDelete(); setConfirmOpen(false); }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
