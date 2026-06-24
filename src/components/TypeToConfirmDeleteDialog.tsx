import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Type-to-confirm delete dialog (Supabase/GitHub/Railway pattern): the destructive
 * action stays disabled until the admin types the exact `name`. Reused for apps and
 * custom objects — pass a tailored title/description/confirmLabel per entity.
 */
export function TypeToConfirmDeleteDialog({
  open,
  onOpenChange,
  name,
  onConfirm,
  pending = false,
  title = "Delete?",
  description,
  confirmLabel = "Delete",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onConfirm: () => void;
  pending?: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
}) {
  const [text, setText] = useState("");
  // Reset the typed value whenever the dialog (re)opens.
  useEffect(() => {
    if (open) setText("");
  }, [open]);

  const matches = text.trim() === name.trim() && name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="type-to-confirm">
            Type <span className="font-semibold text-foreground">{name}</span> to confirm
          </Label>
          <Input
            id="type-to-confirm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={name}
            autoFocus
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches && !pending) onConfirm();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!matches || pending}>
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
