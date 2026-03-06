import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/markdown-content";
import { type MockEmail } from "./mock-data/emails";

interface EmailViewDialogProps {
  email: MockEmail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailViewDialog({
  email,
  open,
  onOpenChange,
}: EmailViewDialogProps) {
  if (!email) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{email.subject}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {email.from.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{email.from.name}</span>
                <span className="text-sm text-muted-foreground">
                  &lt;{email.from.email}&gt;
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                To: {email.to.map((t) => t.name).join(", ")}
              </div>
              <div className="text-sm text-muted-foreground">
                {format(new Date(email.date), "MMM d, yyyy 'at' h:mm a")}
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <MarkdownContent>{email.body}</MarkdownContent>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
