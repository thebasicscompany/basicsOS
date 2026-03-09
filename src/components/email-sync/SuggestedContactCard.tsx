import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import type { SuggestedContact } from "@/types/email-sync";

function ScoreDots({ score }: { score: number }) {
  // Map 0-100 to 1-5 dots
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

function getInitials(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName.slice(0, 2).toUpperCase();
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

interface SuggestedContactCardProps {
  suggestion: SuggestedContact;
  onAccept: (id: number) => void;
  onDismiss: (id: number) => void;
  isAccepting?: boolean;
  isDismissing?: boolean;
  compact?: boolean;
}

export function SuggestedContactCard({
  suggestion,
  onAccept,
  onDismiss,
  isAccepting,
  isDismissing,
  compact,
}: SuggestedContactCardProps) {
  const name = [suggestion.firstName, suggestion.lastName]
    .filter(Boolean)
    .join(" ");
  const initials = getInitials(
    suggestion.firstName,
    suggestion.lastName,
    suggestion.email,
  );

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/50">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {name || suggestion.email}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {suggestion.email}
          </p>
        </div>
        <ScoreDots score={suggestion.score} />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => onAccept(suggestion.id)}
            disabled={isAccepting}
          >
            <CheckIcon className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground"
            onClick={() => onDismiss(suggestion.id)}
            disabled={isDismissing}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">
              {name || suggestion.email}
            </p>
            {suggestion.companyName && (
              <span className="truncate text-xs text-muted-foreground">
                {suggestion.companyName}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {suggestion.email}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {suggestion.emailCount} email
              {suggestion.emailCount !== 1 ? "s" : ""}
            </span>
            {suggestion.signals.isBidirectional && (
              <span className="flex items-center gap-1">
                <span className="text-primary">↔</span> Bidirectional
              </span>
            )}
            {suggestion.lastEmailDate && (
              <span>{getTimeAgo(suggestion.lastEmailDate)}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ScoreDots score={suggestion.score} />
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onAccept(suggestion.id)}
              disabled={isAccepting}
            >
              {isAccepting ? "Adding..." : "Add"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDismiss(suggestion.id)}
              disabled={isDismissing}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
