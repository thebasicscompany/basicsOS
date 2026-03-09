import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { useEmailSearch, useAddContactFromEmail } from "@/hooks/use-email-sync";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import type { EmailParticipant } from "@/types/email-sync";

// Reuse helpers from SuggestedContactCard pattern
function ScoreDots({ score }: { score: number }) {
  const filled = Math.max(1, Math.min(5, Math.round(score / 20)));
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`inline-block size-1.5 rounded-full ${
            i < filled ? "bg-primary" : "bg-muted-foreground/25"
          }`}
        />
      ))}
    </div>
  );
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

interface FindFromEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FindFromEmailDialog({
  open,
  onOpenChange,
}: FindFromEmailDialogProps) {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading } = useEmailSearch(query);
  const addContact = useAddContactFromEmail();

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setQuery(value);
  }, 300);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    debouncedSetQuery(value.trim());
  };

  const participants = useMemo(() => data?.data ?? [], [data]);

  const handleAdd = (p: EmailParticipant) => {
    // Parse name into first/last
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (p.name) {
      const parts = p.name.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
    }
    addContact.mutate({
      email: p.email,
      firstName,
      lastName,
      domain: p.domain ?? undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          setInputValue("");
          setQuery("");
        }
        onOpenChange(val);
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Find from Email</DialogTitle>
          <DialogDescription>
            Search your synced emails to find and add contacts
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or topic..."
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="-mx-6 flex-1 overflow-y-auto px-6">
          {!query || query.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Type at least 2 characters to search
              </p>
            </div>
          ) : isLoading ? (
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
          ) : participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No email participants found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {participants.map((p) => (
                <ParticipantRow
                  key={p.email}
                  participant={p}
                  onAdd={() => handleAdd(p)}
                  onView={() => {
                    if (p.contactId) {
                      onOpenChange(false);
                      navigate(`/objects/contacts/${p.contactId}`);
                    }
                  }}
                  isAdding={
                    addContact.isPending &&
                    (addContact.variables as { email: string })?.email ===
                      p.email
                  }
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ParticipantRow({
  participant: p,
  onAdd,
  onView,
  isAdding,
}: {
  participant: EmailParticipant;
  onAdd: () => void;
  onView: () => void;
  isAdding: boolean;
}) {
  const initials = getInitials(p.name, p.email);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">
              {p.name || p.email}
            </p>
            {p.domain && (
              <span className="truncate text-xs text-muted-foreground">
                {p.domain}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{p.email}</p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {p.emailCount} email{p.emailCount !== 1 ? "s" : ""}
            </span>
            {p.isBidirectional && (
              <span className="flex items-center gap-1">
                <span className="text-primary">↔</span> Bidirectional
              </span>
            )}
            {p.lastEmailDate && <span>{getTimeAgo(p.lastEmailDate)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {p.score != null && <ScoreDots score={p.score} />}
          {p.status === "in_crm" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-green-600 dark:text-green-400"
              onClick={onView}
            >
              <CheckCircleIcon className="size-3.5" weight="fill" />
              In CRM
              <ArrowRightIcon className="size-3" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onAdd}
              disabled={isAdding}
            >
              {isAdding ? "Adding..." : "Add Contact"}
            </Button>
          )}
          {p.status === "dismissed" && (
            <span className="text-[10px] text-muted-foreground">
              Previously dismissed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
