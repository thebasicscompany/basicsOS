import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SuggestedContactCard } from "./SuggestedContactCard";
import {
  useSuggestedContacts,
  useAcceptSuggestion,
  useDismissSuggestion,
  useAcceptAllSuggestions,
} from "@/hooks/use-email-sync";

interface SuggestedContactsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuggestedContactsSheet({
  open,
  onOpenChange,
}: SuggestedContactsSheetProps) {
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSuggestedContacts({
    status: "pending",
    page,
    perPage: 20,
  });
  const acceptMutation = useAcceptSuggestion();
  const dismissMutation = useDismissSuggestion();
  const acceptAllMutation = useAcceptAllSuggestions();

  const suggestions = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = page * 20 < total;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
          <DialogHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle>Suggested Contacts</DialogTitle>
              <DialogDescription className="mt-0.5">
                From your recent Gmail activity
              </DialogDescription>
            </div>
            {suggestions.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setConfirmAllOpen(true)}
              >
                Add All ({total})
              </Button>
            )}
          </DialogHeader>

          <div className="-mx-6 flex-1 overflow-y-auto px-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="size-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : suggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No pending suggestions
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New contacts will be suggested as emails sync
                </p>
              </div>
            ) : (
              <div className="space-y-3 pb-2">
                {suggestions.map((suggestion) => (
                  <SuggestedContactCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAccept={(id) => acceptMutation.mutate(id)}
                    onDismiss={(id) => dismissMutation.mutate(id)}
                    isAccepting={
                      acceptMutation.isPending &&
                      acceptMutation.variables === suggestion.id
                    }
                    isDismissing={
                      dismissMutation.isPending &&
                      dismissMutation.variables === suggestion.id
                    }
                  />
                ))}

                {hasMore && (
                  <Button
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Load more...
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add all suggested contacts?</DialogTitle>
            <DialogDescription>
              This will add all {total} suggested contacts to your CRM. They'll
              be enriched with AI automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAllOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                acceptAllMutation.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmAllOpen(false);
                  },
                });
              }}
              disabled={acceptAllMutation.isPending}
            >
              {acceptAllMutation.isPending
                ? "Adding..."
                : `Add All ${total} Contacts`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
