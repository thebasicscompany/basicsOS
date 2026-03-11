import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { PlusIcon, NoteBlankIcon, MicrophoneIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotes, type Note } from "@/hooks/use-notes";
import {
  useMeetingsByRecord,
  type MeetingWithSummary,
} from "@/hooks/use-meetings";
import { NoteCard } from "./NoteCard";
import { NoteEditorDialog } from "./NoteEditorDialog";
import { MeetingDetailDialog } from "@/components/meetings/MeetingDetailDialog";

type MergedItem =
  | { kind: "note"; note: Note; date: string }
  | { kind: "meeting"; meeting: MeetingWithSummary; date: string };

function MeetingNoteCard({
  meeting,
  onClick,
}: {
  meeting: MeetingWithSummary;
  onClick: () => void;
}) {
  const summaryNote = meeting.summary?.summaryJson?.note;
  const actionItems = meeting.summary?.summaryJson?.actionItems ?? [];

  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-all hover:border-border/80 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MicrophoneIcon className="size-4 shrink-0 text-muted-foreground" />
          <h3 className="text-sm font-semibold leading-snug text-foreground truncate">
            {meeting.title?.trim() || "Untitled Meeting"}
          </h3>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {format(new Date(meeting.startedAt), "MMM d, yyyy")}
        </span>
      </div>
      {summaryNote && (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground ml-6">
          {summaryNote}
        </p>
      )}
      {actionItems.length > 0 && (
        <p className="text-[12px] text-muted-foreground ml-6">
          {actionItems.length} action item{actionItems.length !== 1 ? "s" : ""}
        </p>
      )}
    </button>
  );
}

export function NotesTabContent({
  objectSlug,
  recordId,
}: {
  objectSlug: string;
  recordId: number;
}) {
  const { data, isPending } = useNotes(objectSlug, recordId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [meetingDialogId, setMeetingDialogId] = useState<number | null>(null);

  // F2: Fetch linked meetings for contacts only
  const meetingParams = useMemo(() => {
    if (objectSlug === "contacts") return { contactId: recordId };
    return {};
  }, [objectSlug, recordId]);

  const { data: linkedMeetings } = useMeetingsByRecord(meetingParams);

  const notes = useMemo(() => {
    const raw = data?.data ?? [];
    return raw.map((n) => {
      const r = n as unknown as Record<string, unknown>;
      return {
        id: (r.id ?? r.Id) as number,
        title: (r.title ?? null) as string | null,
        text: (r.text ?? "") as string | null,
        date: (r.date ?? r.Date ?? new Date().toISOString()) as string,
        crmUserId: (r.crmUserId ?? r.crm_user_id ?? null) as number | null,
        contactId: (r.contactId ?? r.contact_id) as number | undefined,
        dealId: (r.dealId ?? r.deal_id) as number | undefined,
        companyId: (r.companyId ?? r.company_id) as number | undefined,
      } satisfies Note;
    });
  }, [data?.data]);

  // Merge notes and meetings, sorted by date DESC
  const mergedItems = useMemo<MergedItem[]>(() => {
    const items: MergedItem[] = [];
    for (const note of notes) {
      items.push({ kind: "note", note, date: note.date });
    }
    for (const meeting of linkedMeetings ?? []) {
      items.push({ kind: "meeting", meeting, date: meeting.startedAt });
    }
    items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    return items;
  }, [notes, linkedMeetings]);

  const handleNewNote = useCallback(() => {
    setSelectedNote(null);
    setEditorOpen(true);
  }, []);

  const handleEditNote = useCallback((note: Note) => {
    setSelectedNote(note);
    setEditorOpen(true);
  }, []);

  const supported = ["contacts", "companies", "deals"].includes(objectSlug);
  if (!supported) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Notes are not available for this object type.
      </div>
    );
  }

  const totalCount = mergedItems.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {totalCount} item{totalCount !== 1 ? "s" : ""}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleNewNote}
          className="h-8 gap-1.5 text-xs"
        >
          <PlusIcon className="size-3.5" />
          New note
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <button
          onClick={handleNewNote}
          className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center transition-colors hover:border-primary/30 hover:bg-accent/30"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <NoteBlankIcon className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No notes yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Click to create your first note
            </p>
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          {mergedItems.map((item) =>
            item.kind === "note" ? (
              <NoteCard
                key={`n-${item.note.id}`}
                title={item.note.title}
                text={item.note.text}
                date={item.note.date}
                onClick={() => handleEditNote(item.note)}
              />
            ) : (
              <MeetingNoteCard
                key={`m-${item.meeting.id}`}
                meeting={item.meeting}
                onClick={() => setMeetingDialogId(item.meeting.id)}
              />
            ),
          )}
        </div>
      )}

      <NoteEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        objectSlug={objectSlug}
        recordId={recordId}
        note={selectedNote}
      />

      <MeetingDetailDialog
        meetingId={meetingDialogId}
        open={meetingDialogId != null}
        onOpenChange={(open) => {
          if (!open) setMeetingDialogId(null);
        }}
      />
    </div>
  );
}
