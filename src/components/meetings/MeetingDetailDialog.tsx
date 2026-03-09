import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeeting, useDeleteMeeting } from "@/hooks/use-meetings";

const SPEAKER_COLORS: Record<string, string> = {
  You: "text-blue-600 dark:text-blue-400",
  "Speaker 1": "text-green-600 dark:text-green-400",
  "Speaker 2": "text-purple-600 dark:text-purple-400",
  "Speaker 3": "text-orange-600 dark:text-orange-400",
  "Remote 0": "text-teal-600 dark:text-teal-400",
  "Remote 1": "text-pink-600 dark:text-pink-400",
};

function getSpeakerColor(speaker: string | null): string {
  if (!speaker) return "text-muted-foreground";
  return SPEAKER_COLORS[speaker] ?? "text-muted-foreground";
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function MeetingDetailDialog({
  meetingId,
  open,
  onOpenChange,
}: {
  meetingId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: meeting, isPending } = useMeeting(open ? meetingId : null);
  const deleteMutation = useDeleteMeeting();

  const handleDelete = () => {
    if (!meetingId) return;
    if (!confirm("Delete this meeting and its transcript?")) return;
    deleteMutation.mutate(meetingId, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isPending
              ? "Loading..."
              : meeting?.title?.trim() || "Untitled Meeting"}
          </DialogTitle>
        </DialogHeader>

        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : meeting ? (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
            {/* Meta */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {format(new Date(meeting.startedAt), "MMM d, yyyy · h:mm a")}
              </span>
              <span>·</span>
              <span>{formatDuration(meeting.duration)}</span>
              <span>·</span>
              <span className="capitalize">{meeting.status}</span>
            </div>

            {/* Summary */}
            {meeting.summary?.summaryJson && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                {meeting.summary.summaryJson.note && (
                  <p className="text-sm leading-relaxed">
                    {meeting.summary.summaryJson.note}
                  </p>
                )}
                {meeting.summary.summaryJson.decisions &&
                  meeting.summary.summaryJson.decisions.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                        Decisions
                      </h4>
                      <ul className="list-disc list-inside text-sm space-y-0.5">
                        {meeting.summary.summaryJson.decisions.map((d, i) => (
                          <li key={i}>
                            {typeof d === "string"
                              ? d
                              : typeof d === "object" && d !== null
                                ? Object.values(d as Record<string, unknown>).filter(Boolean).join(" — ")
                                : String(d)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {meeting.summary.summaryJson.actionItems &&
                  meeting.summary.summaryJson.actionItems.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                        Action Items
                      </h4>
                      <ul className="list-disc list-inside text-sm space-y-0.5">
                        {meeting.summary.summaryJson.actionItems.map((a, i) => (
                          <li key={i}>
                            {typeof a === "string"
                              ? a
                              : typeof a === "object" && a !== null
                                ? Object.values(a as Record<string, unknown>).filter(Boolean).join(" — ")
                                : String(a)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {meeting.summary.summaryJson.followUps &&
                  meeting.summary.summaryJson.followUps.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                        Follow-ups
                      </h4>
                      <ul className="list-disc list-inside text-sm space-y-0.5">
                        {meeting.summary.summaryJson.followUps.map((f, i) => (
                          <li key={i}>
                            {typeof f === "string"
                              ? f
                              : typeof f === "object" && f !== null
                                ? Object.values(f as Record<string, unknown>).filter(Boolean).join(" — ")
                                : String(f)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {/* Transcript */}
            {meeting.transcripts.length > 0 && (
              <div className="flex-1 overflow-hidden">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Transcript
                </h4>
                <ScrollArea className="h-[300px] rounded-lg border p-3">
                  <div className="space-y-1.5">
                    {meeting.transcripts.map((seg) => (
                      <div key={seg.id} className="text-sm">
                        {seg.speaker && (
                          <span
                            className={`font-medium ${getSpeakerColor(seg.speaker)}`}
                          >
                            {seg.speaker}:{" "}
                          </span>
                        )}
                        <span className="text-foreground">{seg.text}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {meeting.transcripts.length === 0 && (
              <div className="rounded-lg bg-muted/50 py-8 text-center text-sm text-muted-foreground">
                No transcript available.
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Meeting"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Meeting not found.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
