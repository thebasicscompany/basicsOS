import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { format, addDays, nextFriday } from "date-fns";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  useMeeting,
  useDeleteMeeting,
  useUpdateMeetingNotes,
  useLinkMeeting,
  useUnlinkMeeting,
  useMarkActionItemsReviewed,
} from "@/hooks/use-meetings";
import { useCreateTask } from "@/hooks/use-tasks";
import { getList } from "@/lib/api/crm";

/** Ordered palette — index 0 = "You", rest = other speakers. */
const SPEAKER_PALETTE = [
  "text-blue-600 dark:text-blue-400", // You
  "text-green-600 dark:text-green-400", // Speaker 2
  "text-purple-600 dark:text-purple-400", // Speaker 3
  "text-orange-600 dark:text-orange-400", // Speaker 4
  "text-teal-600 dark:text-teal-400", // Speaker 5
  "text-pink-600 dark:text-pink-400", // Speaker 6
  "text-amber-600 dark:text-amber-400", // Speaker 7
  "text-rose-600 dark:text-rose-400", // Speaker 8
];

function buildSpeakerMap(
  rawSpeakers: (string | null)[],
): Map<string, { label: string; colorIndex: number }> {
  const map = new Map<string, { label: string; colorIndex: number }>();
  let nextNum = 2;
  const unique = [...new Set(rawSpeakers.filter(Boolean) as string[])];
  for (const raw of unique) {
    if (map.has(raw)) continue;
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
  return (
    SPEAKER_PALETTE[colorIndex % SPEAKER_PALETTE.length] ??
    "text-muted-foreground"
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "\u2014";
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
            <span className="text-muted-foreground shrink-0">&bull;</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Record Search Popover (F2)                                        */
/* ------------------------------------------------------------------ */

type SearchResult = { id: number; name: string };

function RecordSearchPopover({
  type,
  onSelect,
  children,
}: {
  type: "contacts" | "companies" | "deals";
  onSelect: (item: SearchResult) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const result = await getList<Record<string, unknown>>(type, {
          filter: { q },
          pagination: { page: 1, perPage: 8 },
        });
        const mapped: SearchResult[] = result.data.map((r) => ({
          id: (r.id ?? r.Id) as number,
          name:
            type === "contacts"
              ? `${(r.first_name ?? r.firstName ?? "") as string} ${(r.last_name ?? r.lastName ?? "") as string}`.trim() ||
                ((r.email ?? "") as string)
              : ((r.name ?? r.Name ?? "Unnamed") as string),
        }));
        setResults(mapped);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [type],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value), 300);
    },
    [search],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          placeholder={`Search ${type}...`}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          className="h-8 text-sm mb-1"
          autoFocus
        />
        <div className="max-h-48 overflow-auto">
          {loading && (
            <p className="text-xs text-muted-foreground p-2">Searching...</p>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">No results</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() => {
                onSelect(r);
                setOpen(false);
                setQuery("");
                setResults([]);
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/*  Actionable Items Section (F3)                                     */
/* ------------------------------------------------------------------ */

const DUE_DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "This week", days: -1 }, // special: next Friday
  { label: "Next week", days: 7 },
];

function getDueDate(preset: { days: number }): string {
  if (preset.days === -1) {
    return format(nextFriday(new Date()), "yyyy-MM-dd");
  }
  return format(addDays(new Date(), preset.days), "yyyy-MM-dd");
}

function ActionableItemsSection({
  label,
  items,
  contactId,
}: {
  label: string;
  items: string[];
  contactId?: number;
}) {
  const createTask = useCreateTask();
  const [createdIndexes, setCreatedIndexes] = useState<Set<number>>(new Set());

  if (!items.length) return null;

  const handleCreateTask = (text: string, index: number, dueDate: string) => {
    createTask.mutate(
      { text, dueDate, contactId },
      {
        onSuccess: () => {
          setCreatedIndexes((prev) => new Set(prev).add(index));
          toast.success("Task created");
        },
        onError: () => toast.error("Failed to create task"),
      },
    );
  };

  return (
    <div>
      <h5 className="text-xs font-semibold text-muted-foreground mb-1.5">
        {label}
      </h5>
      <ul className="space-y-2">
        {items.map((item, i) => {
          const created = createdIndexes.has(i);
          return (
            <li key={i} className="text-sm leading-relaxed">
              <div className="flex items-start gap-2">
                <span
                  className={`shrink-0 mt-0.5 ${created ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                >
                  {created ? "\u2713" : "\u25CB"}
                </span>
                <span className={created ? "text-muted-foreground" : ""}>
                  {item}
                </span>
              </div>
              {!created && (
                <div className="flex items-center gap-1 ml-5 mt-1">
                  {DUE_DATE_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      disabled={createTask.isPending}
                      onClick={() =>
                        handleCreateTask(item, i, getDueDate(preset))
                      }
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dialog                                                       */
/* ------------------------------------------------------------------ */

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
  const notesMutation = useUpdateMeetingNotes();
  const linkMeeting = useLinkMeeting();
  const unlinkMeeting = useUnlinkMeeting();
  const markReviewed = useMarkActionItemsReviewed();
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync notes from server when meeting loads
  useEffect(() => {
    if (meeting) setNotesValue(meeting.notes ?? "");
  }, [meeting]);

  // Debounced auto-save notes
  const handleNotesChange = useCallback(
    (value: string) => {
      setNotesValue(value);
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
      if (!meetingId) return;
      const id = meetingId;
      notesSaveTimer.current = setTimeout(() => {
        notesMutation.mutate({ id, notes: value });
      }, 1500);
    },
    [meetingId, notesMutation],
  );

  // Save immediately on blur
  const handleNotesBlur = useCallback(() => {
    if (notesSaveTimer.current) {
      clearTimeout(notesSaveTimer.current);
      notesSaveTimer.current = null;
    }
    if (meetingId) notesMutation.mutate({ id: meetingId, notes: notesValue });
  }, [meetingId, notesValue, notesMutation]);

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

  const hasActionItems = !!(
    summaryJson?.actionItems?.length || summaryJson?.followUps?.length
  );

  // Auto-mark reviewed when user sees action items
  useEffect(() => {
    if (
      meeting?.id &&
      hasActionItems &&
      !summaryJson?._reviewed &&
      meeting.status === "completed"
    ) {
      markReviewed.mutate(meeting.id);
    }
    // Only run once when meeting loads with unreviewed items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id, hasActionItems]);

  // F2: linked contact (one per meeting)
  const links = meeting?.links;
  const linkedContact = links?.contacts?.[0] ?? null;
  const firstContactId = linkedContact?.id;

  const handleLinkContact = useCallback(
    (item: { id: number }) => {
      if (!meetingId) return;
      linkMeeting.mutate({ meetingId, contactId: item.id });
    },
    [meetingId, linkMeeting],
  );

  const handleUnlinkContact = useCallback(
    (id: number) => {
      if (!meetingId) return;
      unlinkMeeting.mutate({ meetingId, contactId: id });
    },
    [meetingId, unlinkMeeting],
  );

  const handleCopyTranscript = useCallback(() => {
    if (!groups.length) return;
    const text = groups
      .map((g) => `${g.label}:\n${g.lines.join(" ")}`)
      .join("\n\n");

    const doCopy = async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
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

  const showTranscript = hasSummary ? transcriptOpen : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
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
                {format(
                  new Date(meeting.startedAt),
                  "MMM d, yyyy \u00B7 h:mm a",
                )}
              </span>
              <span>&middot;</span>
              <span>{formatDuration(meeting.duration)}</span>
              <span>&middot;</span>
              <span className="capitalize">{meeting.status}</span>
            </div>

            {/* F2: Assign to contact (one per meeting) */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Assign to contact
              </h4>
              <div className="flex flex-wrap items-center gap-1.5">
                {linkedContact && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 text-xs font-medium">
                    {linkedContact.name}
                    <button
                      onClick={() => handleUnlinkContact(linkedContact.id)}
                      className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100"
                    >
                      &times;
                    </button>
                  </span>
                )}

                <RecordSearchPopover
                  type="contacts"
                  onSelect={(item) => handleLinkContact(item)}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground"
                  >
                    {linkedContact ? "Change contact" : "+ Contact"}
                  </Button>
                </RecordSearchPopover>
              </div>
            </div>

            {/* Summary */}
            {hasSummary && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                {summaryJson?.note && (
                  <p className="text-sm leading-relaxed">{summaryJson.note}</p>
                )}
                {summaryJson?.decisions && summaryJson.decisions.length > 0 && (
                  <SummaryList
                    label="Decisions"
                    items={summaryJson.decisions}
                  />
                )}
                {/* F3: Actionable items replace static SummaryList */}
                {summaryJson?.actionItems &&
                  summaryJson.actionItems.length > 0 && (
                    <ActionableItemsSection
                      label="Action Items"
                      items={summaryJson.actionItems}
                      contactId={firstContactId}
                    />
                  )}
                {summaryJson?.followUps && summaryJson.followUps.length > 0 && (
                  <ActionableItemsSection
                    label="Follow-ups"
                    items={summaryJson.followUps}
                    contactId={firstContactId}
                  />
                )}
              </div>
            )}

            {/* User Notes */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  Your Notes
                </h4>
                {notesMutation.isPending && (
                  <span className="text-[10px] text-muted-foreground">
                    Saving...
                  </span>
                )}
              </div>
              <Textarea
                value={notesValue}
                onChange={(e) => handleNotesChange(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add notes about this meeting..."
                className="min-h-[80px] resize-y text-sm leading-relaxed bg-transparent border-0 p-0 shadow-none focus-visible:ring-0"
              />
            </div>

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
                      &#9654;
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
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect width="14" height="14" x="8" y="8" rx="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
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
