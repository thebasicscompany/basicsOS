"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Card,
  Input,
  PageHeader,
  addToast,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Code2,
} from "@basicsos/ui";

const AUTOSAVE_MS = 1500;

// Next.js page — requires default export
const DocumentDetailPage = (): JSX.Element => {
  const params = useParams();
  const id = params["id"] as string;

  const utils = trpc.useUtils();
  const { data: doc, error, isLoading } = trpc.knowledge.get.useQuery({ id });

  const updateMutation = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      void utils.knowledge.list.invalidate();
    },
    onError: (err) => {
      addToast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const [localTitle, setLocalTitle] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to always-current save so keyboard/timer callbacks never go stale
  const saveRef = useRef<(titleOverride?: string) => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    onUpdate: () => {
      setIsDirty(true);
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => saveRef.current(), AUTOSAVE_MS);
    },
  });

  // Load content once both doc and editor are ready
  useEffect(() => {
    if (!doc || !editor || editor.isDestroyed) return;
    setLocalTitle(doc.title);
    if (doc.contentJson) {
      editor.commands.setContent(
        doc.contentJson as Parameters<typeof editor.commands.setContent>[0],
      );
    }
    // Only re-run when the document ID or editor instance changes
  }, [doc?.id, editor]);

  const save = useCallback(
    (titleOverride?: string): void => {
      if (!editor || editor.isDestroyed || !doc) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      updateMutation.mutate({
        id,
        title: titleOverride ?? localTitle,
        contentJson: editor.getJSON() as Record<string, unknown>,
      });
      setIsDirty(false);
    },
    [editor, doc, id, localTitle, updateMutation],
  );

  // Keep ref in sync with latest save closure
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Cmd+S / Ctrl+S — uses ref so no deps needed
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Flush autosave on unmount
  useEffect(
    () => () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    },
    [],
  );

  if (error) {
    return <div className="p-8 text-center text-destructive">{error.message}</div>;
  }

  if (isLoading || !doc) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4 animate-pulse">
        <div className="h-4 w-24 rounded bg-stone-200" />
        <div className="h-10 w-2/3 rounded bg-stone-200" />
        <div className="h-96 rounded-xl bg-stone-100" />
      </div>
    );
  }

  const saving = updateMutation.isPending;
  const statusText = saving ? "Saving…" : isDirty ? "Unsaved changes" : "Saved";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Title bar */}
      <PageHeader
        title=""
        backHref="/knowledge"
        backLabel="Knowledge Base"
        className="mb-6"
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-500">{statusText}</span>
            <Button onClick={() => save()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      />

      {/* Document title */}
      <Input
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        className="w-full text-4xl font-bold text-stone-900 border-none bg-transparent mb-4 placeholder-stone-300 shadow-none h-auto p-0"
        placeholder="Untitled Document"
      />

      {/* TipTap editor */}
      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex gap-0.5 border-b border-border px-2 py-1.5">
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
              Icon: Heading1,
              title: "Heading 1",
              action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
              active: () => editor?.isActive("heading", { level: 1 }) ?? false,
            },
            {
              Icon: Heading2,
              title: "Heading 2",
              action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
              active: () => editor?.isActive("heading", { level: 2 }) ?? false,
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
            {
              Icon: Code2,
              title: "Code block",
              action: () => editor?.chain().focus().toggleCodeBlock().run(),
              active: () => editor?.isActive("codeBlock") ?? false,
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
              <btn.Icon size={16} />
            </Button>
          ))}
        </div>

        {/* Content */}
        <EditorContent editor={editor} />
      </Card>

      <p className="mt-3 text-xs text-muted-foreground text-right">
        Auto-saves as you type · Cmd+S to save now
      </p>
    </div>
  );
};

export default DocumentDetailPage;
