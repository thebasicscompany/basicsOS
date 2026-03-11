import { useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
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

/** Ordered palette — index 0 = "You", rest = other speakers. */
const SPEAKER_PALETTE = [
  "text-blue-600 dark:text-blue-400",    // You
  "text-green-600 dark:text-green-400",   // Speaker 2
  "text-purple-600 dark:text-purple-400", // Speaker 3
  "text-orange-600 dark:text-orange-400", // Speaker 4
  "text-teal-600 dark:text-teal-400",     // Speaker 5
  "text-pink-600 dark:text-pink-400",     // Speaker 6
  "text-amber-600 dark:text-amber-400",   // Speaker 7
  "text-rose-600 dark:text-rose-400",     // Speaker 8
];

/**
 * Normalize raw speaker labels ("Speaker 0", "Remote 0", "You", etc.)
 * into a unified "You" / "Speaker 2" / "Speaker 3" numbering.
 *
 * Speaker 0 → "You" (the local user).
 * Remote N → sequential "Speaker N" starting from 2.
 */
function buildSpeakerMap(
  rawSpeakers: (string | null)[],
): Map<string, { label: string; colorIndex: number }> {
  const map = new Map<string, { label: string; colorIndex: number }>();
  let nextNum = 2; // "You" is implicitly 1

  const unique = [...new Set(rawSpeakers.filter(Boolean) as string[])];
  for (const raw of unique) {
    if (map.has(raw)) continue;

    // "Speaker 0" or "You" → local user
    if (raw === "Speaker 0" || raw === "You") {
      map.set(raw, { label: "You", colorIndex: 0 });
    } else {
      map.set(raw, { label: `Speaker ${nextNum}`, colorIndex: nextNum - 1 });
      nextNum++;
    }
  }
  return map;
}

function getSpeakerColor(colorIndex: number): string {
  return SPEAKER_PALETTE[colorIndex % SPEAKER_PALETTE.length] ?? "text-muted-foreground";
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

type TranscriptSegment = {
  id: number;
  speaker: string | null;
  text: string;
  timestampMs: number | null;
};

/** Group consecutive segments from the same speaker into blocks. */
function groupTranscripts(
  segments: TranscriptSegment[],
  speakerMap: Map<string, { label: string; colorIndex: number }>,
): { label: string; colorIndex: number; lines: string[]; firstId: number }[] {
  const groups: {
    label: string;
    colorIndex: number;
    lines: string[];
    firstId: number;
  }[] = [];

  for (const seg of segments) {
    const info = seg.speaker ? speakerMap.get(seg.speaker) : null;
    const label = info?.label ?? seg.speaker ?? "Unknown";
    const colorIndex = info?.colorIndex ?? 0;

    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.lines.push(seg.text);
    } else {
      groups.push({ label, colorIndex, lines: [seg.text], firstId: seg.id });
    }
  }
  return groups;
}

function SummaryList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h5 className="text-xs font-semibold text-muted-foreground mb-1.5">
        {label}
      </h5>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed flex gap-2">
            <span className="text-muted-foreground shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDelete = () => {
    if (!meetingId) return;
    if (!confirm("Delete this meeting and its transcript?")) return;
    deleteMutation.mutate(meetingId, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const speakerMap = useMemo(
    () =>
      meeting
        ? buildSpeakerMap(meeting.transcripts.map((t) => t.speaker))
        : new Map<string, { label: string; colorIndex: number }>(),
    [meeting],
  );
  const groups = useMemo(
    () => (meeting ? groupTranscripts(meeting.transcripts, speakerMap) : []),
    [meeting, speakerMap],
  );

  const summaryJson = meeting?.summary?.summaryJson;
  const hasSummary = !!(
    summaryJson?.note ||
    summaryJson?.decisions?.length ||
    summaryJson?.actionItems?.length ||
    summaryJson?.followUps?.length
  );

  const handleCopyTranscript = useCallback(() => {
    if (!groups.length) return;
    const text = groups
      .map((g) => `${g.label}:\n${g.lines.join(" ")}`)
      .join("\n\n");

    // Use clipboard API with fallback
    const doCopy = async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback for contexts where clipboard API fails
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success("Transcript copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    };
    void doCopy();
  }, [groups]);

  // Auto-collapse transcript when summary exists, expand when no summary
  const showTranscript = hasSummary ? transcriptOpen : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
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
            {hasSummary && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                {summaryJson?.note && (
                  <p className="text-sm leading-relaxed">
                    {summaryJson.note}
                  </p>
                )}
                {summaryJson?.decisions && summaryJson.decisions.length > 0 && (
                  <SummaryList label="Decisions" items={summaryJson.decisions} />
                )}
                {summaryJson?.actionItems && summaryJson.actionItems.length > 0 && (
                  <SummaryList label="Action Items" items={summaryJson.actionItems} />
                )}
                {summaryJson?.followUps && summaryJson.followUps.length > 0 && (
                  <SummaryList label="Follow-ups" items={summaryJson.followUps} />
                )}
              </div>
            )}

            {/* User Notes */}
            {meeting.notes && (
              <div className="rounded-lg border bg-muted/20 p-4">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
                  Your Notes
                </h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {meeting.notes}
                </p>
              </div>
            )}

            {/* Transcript */}
            {groups.length > 0 && (
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setTranscriptOpen(!showTranscript)}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span
                      className="inline-block transition-transform"
                      style={{
                        transform: showTranscript
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                      }}
                    >
                      ▶
                    </span>
                    Transcript ({meeting.transcripts.length} segments)
                  </button>
                  <div className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs gap-1"
                    onClick={handleCopyTranscript}
                  >
                    {copied ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        Copy Transcript
                      </>
                    )}
                  </Button>
                </div>
                {showTranscript && (
                  <ScrollArea className="h-[300px] rounded-lg border p-3">
                    <div className="space-y-3">
                      {groups.map((group) => (
                        <div key={group.firstId}>
                          <div
                            className={`text-xs font-semibold mb-0.5 ${getSpeakerColor(group.colorIndex)}`}
                          >
                            {group.label}
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">
                            {group.lines.join(" ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
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
