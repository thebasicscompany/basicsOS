import { useState, useCallback, useEffect, useRef } from "react";
import { TrashIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  type Note,
} from "@/hooks/use-notes";

interface NoteEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectSlug: string;
  recordId: number;
  note?: Note | null;
}

export function NoteEditorDialog({
  open,
  onOpenChange,
  objectSlug,
  recordId,
  note,
}: NoteEditorDialogProps) {
  const isNew = !note;
  const [title, setTitle] = useState(note?.title ?? "");
  const [text, setText] = useState(note?.text ?? "");
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">(
    "saved",
  );
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const createNote = useCreateNote(objectSlug);
  const updateNote = useUpdateNote(objectSlug);
  const deleteNote = useDeleteNote(objectSlug);

  useEffect(() => {
    if (open) {
      setTitle(note?.title ?? "");
      setText(note?.text ?? "");
      setHasChanges(false);
      setSaveStatus("saved");
    }
  }, [open, note]);

  // Auto-resize title textarea
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [title]);

  const handleSave = useCallback(() => {
    if (isNew) {
      if (!title.trim() && !text.trim()) return;
      setSaveStatus("saving");
      createNote.mutate(
        { recordId, title: title.trim() || undefined, text: text.trim() },
        {
          onSuccess: () => {
            setSaveStatus("saved");
            onOpenChange(false);
          },
          onError: (err) => {
            setSaveStatus("unsaved");
            showError(err, "Failed to create note");
          },
        },
      );
    } else {
      setSaveStatus("saving");
      updateNote.mutate(
        {
          id: note.id,
          recordId,
          title: title.trim() || undefined,
          text: text.trim(),
        },
        {
          onSuccess: () => {
            setSaveStatus("saved");
            setHasChanges(false);
          },
          onError: (err) => {
            setSaveStatus("unsaved");
            showError(err, "Failed to update note");
          },
        },
      );
    }
  }, [
    isNew,
    title,
    text,
    recordId,
    note,
    createNote,
    updateNote,
    onOpenChange,
  ]);

  const handleDelete = useCallback(() => {
    if (!note) return;
    deleteNote.mutate(
      { id: note.id, recordId },
      {
        onSuccess: () => {
          toast.success("Note deleted");
          onOpenChange(false);
        },
        onError: (err) => showError(err, "Failed to delete note"),
      },
    );
  }, [note, recordId, deleteNote, onOpenChange]);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && hasChanges) {
        handleSave();
      } else {
        onOpenChange(nextOpen);
      }
    },
    [hasChanges, handleSave, onOpenChange],
  );

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Focus the editor below
        const editorEl = document.querySelector(
          ".tiptap[contenteditable]",
        ) as HTMLElement | null;
        editorEl?.focus();
      }
    },
    [],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-w-4xl flex-col w-[90vw] h-[90vh] p-0 gap-0 [&>button]:hidden">
        {/* Top bar — minimal, just status + actions */}
        <div className="flex items-center justify-between px-5 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            {saveStatus === "saving" && (
              <span className="text-xs">Saving…</span>
            )}
            {saveStatus === "saved" && hasChanges === false && !isNew && (
              <span className="text-xs">Saved</span>
            )}
            {saveStatus === "unsaved" && (
              <span className="text-xs text-amber-500">Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isNew && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteNote.isPending}
              >
                <TrashIcon className="size-4" />
              </Button>
            )}
            {hasChanges && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleSave}
                disabled={createNote.isPending || updateNote.isPending}
              >
                Save
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={() => handleClose(false)}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>

        {/* Editor area — centered, max-width for readability */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-12 pb-24 pt-4">
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasChanges(true);
                setSaveStatus("unsaved");
              }}
              onKeyDown={handleTitleKeyDown}
              placeholder="Untitled"
              rows={1}
              className="w-full resize-none bg-transparent text-4xl font-bold leading-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
            <RichTextEditor
              content={text}
              onChange={(md) => {
                setText(md);
                setHasChanges(true);
                setSaveStatus("unsaved");
              }}
              placeholder="Type '/' for commands…"
              autoFocus={isNew}
              className="mt-4 min-h-[400px]"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
