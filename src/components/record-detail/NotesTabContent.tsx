import { useState, useMemo, useCallback } from "react";
import { PlusIcon, NoteBlankIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotes, type Note } from "@/hooks/use-notes";
import { NoteCard } from "./NoteCard";
import { NoteEditorDialog } from "./NoteEditorDialog";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {notes.length} note{notes.length !== 1 ? "s" : ""}
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
      ) : notes.length === 0 ? (
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
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              title={note.title}
              text={note.text}
              date={note.date}
              onClick={() => handleEditNote(note)}
            />
          ))}
        </div>
      )}

      <NoteEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        objectSlug={objectSlug}
        recordId={recordId}
        note={selectedNote}
      />
    </div>
  );
}
