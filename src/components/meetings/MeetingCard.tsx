import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { Meeting } from "@/hooks/use-meetings";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const statusVariant = (
  status: string,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "completed":
      return "default";
    case "recording":
    case "processing":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
};

export function MeetingCard({
  meeting,
  onClick,
}: {
  meeting: Meeting;
  onClick: () => void;
}) {
  const title = meeting.title?.trim() || "Untitled Meeting";
  const date = format(new Date(meeting.startedAt), "MMM d, yyyy · h:mm a");
  const duration = formatDuration(meeting.duration);

  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-all hover:border-border/80 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
          {title}
        </h3>
        <Badge variant={statusVariant(meeting.status)} className="shrink-0">
          {meeting.status}
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{date}</span>
        {duration && (
          <>
            <span>·</span>
            <span>{duration}</span>
          </>
        )}
      </div>
    </button>
  );
}
