"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Bold,
  Italic,
  List,
  ListOrdered,
} from "@basicsos/ui";

const AUTOSAVE_MS = 1000;

interface CrmNotesPanelProps {
  entity: "contact" | "company" | "deal";
  recordId: string;
}

export function CrmNotesPanel({ entity, recordId }: CrmNotesPanelProps): JSX.Element {
  const { data: note, isLoading } = trpc.crm.notes.get.useQuery({ entity, recordId });

  const upsert = trpc.crm.notes.upsert.useMutation();

  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Add notes…" }),
    ],
    onUpdate: () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => saveRef.current(), AUTOSAVE_MS);
    },
  });

  // Load saved content once per recordId (resets if recordId changes)
  useEffect(() => {
    if (!editor || editor.isDestroyed || initializedFor === recordId) return;
    if (isLoading) return;
    const content = note?.content as unknown[] | undefined;
    if (Array.isArray(content) && content.length > 0) {
      editor.commands.setContent(content as Parameters<typeof editor.commands.setContent>[0]);
    } else {
      editor.commands.clearContent();
    }
    setInitializedFor(recordId);
  }, [note, editor, initializedFor, recordId, isLoading]);

  const save = useCallback((): void => {
    if (!editor || editor.isDestroyed) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const json = editor.getJSON();
    const content = (json.content ?? []) as unknown[];
    upsert.mutate({ entity, recordId, content });
  }, [editor, entity, recordId, upsert]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(
    () => () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    },
    [],
  );

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-stone-700">Notes</CardTitle>
        {upsert.isPending && (
          <span className="text-xs text-stone-400">Saving…</span>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-md bg-stone-100" />
        ) : (
          <Card className="overflow-hidden border border-stone-200">
            <div className="flex gap-0.5 border-b border-stone-200 px-2 py-1">
              {[
                {
                  Icon: Bold,
                  title: "Bold",
                  action: () => editor?.chain().focus().toggleBold().run(),
                  active: () => editor?.isActive("bold") ?? false,
                },
                {
                  Icon: Italic,
                  title: "Italic",
                  action: () => editor?.chain().focus().toggleItalic().run(),
                  active: () => editor?.isActive("italic") ?? false,
                },
                {
                  Icon: List,
                  title: "Bullet list",
                  action: () => editor?.chain().focus().toggleBulletList().run(),
                  active: () => editor?.isActive("bulletList") ?? false,
                },
                {
                  Icon: ListOrdered,
                  title: "Ordered list",
                  action: () => editor?.chain().focus().toggleOrderedList().run(),
                  active: () => editor?.isActive("orderedList") ?? false,
                },
              ].map((btn) => (
                <Button
                  key={btn.title}
                  variant="ghost"
                  size="icon"
                  title={btn.title}
                  onClick={btn.action}
                  className={btn.active() ? "bg-stone-200" : ""}
                >
                  <btn.Icon size={14} />
                </Button>
              ))}
            </div>
            <EditorContent editor={editor} className="min-h-[160px] px-3 py-2 text-sm" />
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
